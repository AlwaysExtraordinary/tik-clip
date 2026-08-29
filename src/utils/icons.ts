import { addIcon } from '@iconify/react';

// 基础与导航
import zap from '@iconify-icons/lucide/zap';
import squarePlay from '@iconify-icons/lucide/square-play';
import settings from '@iconify-icons/lucide/settings';
import panelLeftOpen from '@iconify-icons/lucide/panel-left-open';
import panelLeftClose from '@iconify-icons/lucide/panel-left-close';

// 窗口控制
import minus from '@iconify-icons/lucide/minus';
import copy from '@iconify-icons/lucide/copy';
import square from '@iconify-icons/lucide/square';
import x from '@iconify-icons/lucide/x';

// 视频播放与控制
import play from '@iconify-icons/lucide/play';
import pause from '@iconify-icons/lucide/pause';
import playCircle from '@iconify-icons/lucide/play-circle';
import skipBack from '@iconify-icons/lucide/skip-back';
import skipForward from '@iconify-icons/lucide/skip-forward';
import fastForward from '@iconify-icons/lucide/fast-forward';
import maximize from '@iconify-icons/lucide/maximize';
import maximize2 from '@iconify-icons/lucide/maximize-2';
import minimize from '@iconify-icons/lucide/minimize';
import crop from '@iconify-icons/lucide/crop';
import rectangleHorizontal from '@iconify-icons/lucide/rectangle-horizontal';
import timer from '@iconify-icons/lucide/timer';
import timerOff from '@iconify-icons/lucide/timer-off';
import volume from '@iconify-icons/lucide/volume';
import volume1 from '@iconify-icons/lucide/volume-1';
import volume2 from '@iconify-icons/lucide/volume-2';
import volumeX from '@iconify-icons/lucide/volume-x';
import video from '@iconify-icons/lucide/video';
import videoOff from '@iconify-icons/lucide/video-off';
import film from '@iconify-icons/lucide/film';
import scissors from '@iconify-icons/lucide/scissors';
import arrowDownToDot from '@iconify-icons/lucide/arrow-down-to-dot';

// 视频列表与页面操作
import folder from '@iconify-icons/lucide/folder';
import folderPlus from '@iconify-icons/lucide/folder-plus';
import folderSearch from '@iconify-icons/lucide/folder-search';
import folderSymlink from '@iconify-icons/lucide/folder-symlink';
import imageOff from '@iconify-icons/lucide/image-off';
import eyeOff from '@iconify-icons/lucide/eye-off';
import pencil from '@iconify-icons/lucide/pencil';
import pencilLine from '@iconify-icons/lucide/pencil-line';
import trash2 from '@iconify-icons/lucide/trash-2';
import tag from '@iconify-icons/lucide/tag';
import ellipsis from '@iconify-icons/lucide/ellipsis';
import plus from '@iconify-icons/lucide/plus';
import check from '@iconify-icons/lucide/check';
import arrowLeft from '@iconify-icons/lucide/arrow-left';
import unlock from '@iconify-icons/lucide/unlock';

// 状态与设置
import loader2 from '@iconify-icons/lucide/loader-2';
import alertCircle from '@iconify-icons/lucide/alert-circle';
import alertTriangle from '@iconify-icons/lucide/alert-triangle';
import shieldAlert from '@iconify-icons/lucide/shield-alert';
import refreshCw from '@iconify-icons/lucide/refresh-cw';
import languages from '@iconify-icons/lucide/languages';
import sun from '@iconify-icons/lucide/sun';
import moon from '@iconify-icons/lucide/moon';
import laptop from '@iconify-icons/lucide/laptop';

/**
 * 集中注册项目中所有使用的 Lucide 图标至 Iconify 本地离线缓存
 * 彻底杜绝运行时在线 HTTP 请求，实现零延迟、零闪烁与纯离线可用
 */
export function setupIcons(): void {
  const iconMap: Record<string, typeof zap> = {
    'lucide:zap': zap,
    'lucide:square-play': squarePlay,
    'lucide:settings': settings,
    'lucide:panel-left-open': panelLeftOpen,
    'lucide:panel-left-close': panelLeftClose,

    'lucide:minus': minus,
    'lucide:copy': copy,
    'lucide:square': square,
    'lucide:x': x,

    'lucide:play': play,
    'lucide:pause': pause,
    'lucide:play-circle': playCircle,
    'lucide:skip-back': skipBack,
    'lucide:skip-forward': skipForward,
    'lucide:fast-forward': fastForward,
    'lucide:maximize': maximize,
    'lucide:maximize-2': maximize2,
    'lucide:minimize': minimize,
    'lucide:crop': crop,
    'lucide:rectangle-horizontal': rectangleHorizontal,
    'lucide:timer': timer,
    'lucide:timer-off': timerOff,
    'lucide:volume': volume,
    'lucide:volume-1': volume1,
    'lucide:volume-2': volume2,
    'lucide:volume-x': volumeX,
    'lucide:video': video,
    'lucide:video-off': videoOff,
    'lucide:film': film,
    'lucide:scissors': scissors,
    'lucide:arrow-down-to-dot': arrowDownToDot,

    'lucide:folder': folder,
    'lucide:folder-plus': folderPlus,
    'lucide:folder-search': folderSearch,
    'lucide:folder-symlink': folderSymlink,
    'lucide:image-off': imageOff,
    'lucide:eye-off': eyeOff,
    'lucide:pencil': pencil,
    'lucide:pencil-line': pencilLine,
    'lucide:trash-2': trash2,
    'lucide:tag': tag,
    'lucide:ellipsis': ellipsis,
    'lucide:plus': plus,
    'lucide:check': check,
    'lucide:arrow-left': arrowLeft,
    'lucide:unlock': unlock,

    'lucide:loader-2': loader2,
    'lucide:alert-circle': alertCircle,
    'lucide:alert-triangle': alertTriangle,
    'lucide:shield-alert': shieldAlert,
    'lucide:refresh-cw': refreshCw,
    'lucide:languages': languages,
    'lucide:sun': sun,
    'lucide:moon': moon,
    'lucide:laptop': laptop,
  };

  Object.entries(iconMap).forEach(([name, iconData]) => {
    addIcon(name, iconData);
  });
}
