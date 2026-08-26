use http_range::HttpRange;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use tauri::http::{
    header::{
        ACCEPT_RANGES, ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
        ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_EXPOSE_HEADERS, ACCESS_CONTROL_MAX_AGE,
        CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, RANGE,
    },
    Method, Request, Response, StatusCode,
};

/// 处理 stream:// 协议的流式媒体请求，支持 HTTP Range（206 Partial Content）分片和 CORS
pub fn handle_stream_request(
    request: Request<Vec<u8>>,
) -> Result<Response<Vec<u8>>, Box<dyn std::error::Error + Send + Sync>> {
    // 处理 CORS 预检请求
    if request.method() == Method::OPTIONS {
        return Ok(Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
            .header(
                ACCESS_CONTROL_ALLOW_HEADERS,
                "Range, Content-Type, Origin, Accept",
            )
            .header(
                ACCESS_CONTROL_EXPOSE_HEADERS,
                "Content-Range, Content-Length, Accept-Ranges",
            )
            .header(ACCESS_CONTROL_MAX_AGE, "86400")
            .body(Vec::new())?);
    }

    let raw_path = request.uri().path();
    let decoded_path = percent_encoding::percent_decode_str(raw_path)
        .decode_utf8_lossy()
        .to_string();

    let clean_path = decoded_path.trim_start_matches('/');

    #[cfg(target_os = "windows")]
    let file_path = PathBuf::from(clean_path);

    #[cfg(not(target_os = "windows"))]
    let file_path = PathBuf::from(format!("/{}", clean_path));

    if !file_path.exists() || !file_path.is_file() {
        return Ok(Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(CONTENT_TYPE, "text/plain")
            .body(format!("File not found: {}", file_path.display()).into_bytes())?);
    }

    let mut file = File::open(&file_path)?;
    let metadata = file.metadata()?;
    let total_len = metadata.len();

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mime_type = match ext.as_str() {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "ogv" | "ogg" => "video/ogg",
        "avi" => "video/x-msvideo",
        "ts" | "m2ts" => "video/mp2t",
        "flv" => "video/x-flv",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "m4a" | "aac" => "audio/mp4",
        "flac" => "audio/flac",
        "oga" | "opus" => "audio/ogg",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    };

    let response_builder = Response::builder()
        .header(CONTENT_TYPE, mime_type)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(
            ACCESS_CONTROL_ALLOW_HEADERS,
            "Range, Content-Type, Origin, Accept",
        )
        .header(
            ACCESS_CONTROL_EXPOSE_HEADERS,
            "Content-Range, Content-Length, Accept-Ranges",
        )
        .header(ACCEPT_RANGES, "bytes");

    // 处理 HEAD 请求
    if request.method() == Method::HEAD {
        return Ok(response_builder
            .status(StatusCode::OK)
            .header(CONTENT_LENGTH, total_len)
            .body(Vec::new())?);
    }

    // 处理 Range 请求 (HTTP 206 Partial Content)
    if let Some(range_header) = request.headers().get(RANGE) {
        let range_str = range_header.to_str().unwrap_or("");
        if let Ok(ranges) = HttpRange::parse(range_str, total_len) {
            if let Some(first_range) = ranges.first() {
                let start = first_range.start;
                // 单次请求最大读取 16MB，保证音视频流有充足缓存且 seek 极速响应
                const MAX_CHUNK_SIZE: u64 = 16 * 1024 * 1024;
                let length = first_range.length.min(MAX_CHUNK_SIZE);
                let end = (start + length - 1).min(total_len.saturating_sub(1));
                let bytes_to_read = if total_len == 0 { 0 } else { end - start + 1 };

                if total_len > 0 && start < total_len {
                    file.seek(SeekFrom::Start(start))?;
                    let mut buffer = vec![0u8; bytes_to_read as usize];
                    file.read_exact(&mut buffer)?;

                    return Ok(response_builder
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(
                            CONTENT_RANGE,
                            format!("bytes {}-{}/{}", start, end, total_len),
                        )
                        .header(CONTENT_LENGTH, bytes_to_read)
                        .body(buffer)?);
                }
            }
        }

        // 无效 Range 范围
        return Ok(response_builder
            .status(StatusCode::RANGE_NOT_SATISFIABLE)
            .header(CONTENT_RANGE, format!("bytes */{}", total_len))
            .body(Vec::new())?);
    }

    // 无 Range 头部时的默认请求（如首段嗅探或小文件）
    const INITIAL_CHUNK_MAX: u64 = 2 * 1024 * 1024;
    let bytes_to_read = total_len.min(INITIAL_CHUNK_MAX);
    let mut buffer = vec![0u8; bytes_to_read as usize];
    if bytes_to_read > 0 {
        file.seek(SeekFrom::Start(0))?;
        file.read_exact(&mut buffer)?;
    }

    if bytes_to_read < total_len {
        Ok(response_builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header(
                CONTENT_RANGE,
                format!("bytes 0-{}/{}", bytes_to_read - 1, total_len),
            )
            .header(CONTENT_LENGTH, bytes_to_read)
            .body(buffer)?)
    } else {
        Ok(response_builder
            .status(StatusCode::OK)
            .header(CONTENT_LENGTH, total_len)
            .body(buffer)?)
    }
}
