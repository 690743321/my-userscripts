// ==UserScript==
// @name         B站禁止登录弹窗+自动最高清晰度+无限试看+未登录看全部评论
// @namespace    https://www.bilibili.com
// @version      2.3.0
// @description  优化版：屏蔽B站登录弹窗；自动最高清晰度（720P/1080P）；无限试看绕过大会员试看时长，自动续播；未登录可查看全部评论（含楼中楼/翻页）；本地文件自动更新。
// @author       自写脚本
// @match        *://*.bilibili.com/*
// @match        *://*.bilibili.tv/*
// @match        *://*.bilibili.co/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    file:///D:/备份/脚本猫/自写脚本/bilibili禁登录弹窗-最高清-无限试看_latest.user.js
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    var VERSION = '2.3.0';
    var QN_LABELS = {16:'360P',32:'480P',64:'720P',74:'720P60',80:'1080P',112:'1080P+',116:'1080P60',120:'4K'};

    /* ============================================================
     * 0. 配置持久化（优先，document-start 立即执行）
     * ============================================================ */
    var options = {
        preferQuality: GM_getValue('preferQuality', '1080'),
        isWaitUntilHighQualityLoaded: GM_getValue('isWaitUntilHighQualityLoaded', false),
    };

    var LS_KEYS = ['bilibili_player_codec_prefer_type','b_miniplayer','recommend_auto_play','bpx_player_profile'];

    // 把脚本存储的配置同步到页面 localStorage
    LS_KEYS.forEach(function (key) {
        var value = GM_getValue(key);
        if (value) window.localStorage.setItem(key, value);
    });

    // 劫持 setItem，保存页面配置回脚本存储
    var originSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        if (key === 'bpx_player_profile') {
            try {
                var profile = JSON.parse(value);
                if (!profile.audioEffect) profile.audioEffect = {};
                value = JSON.stringify(profile);
            } catch (e) {}
        }
        originSetItem.call(this, key, value);
        if (LS_KEYS.indexOf(key) >= 0) {
            setTimeout(function () {
                GM_setValue('bilibili_player_codec_prefer_type', window.localStorage.getItem('bilibili_player_codec_prefer_type') || '0');
                GM_setValue('b_miniplayer', window.localStorage.getItem('b_miniplayer') || '1');
                GM_setValue('recommend_auto_play', window.localStorage.getItem('recommend_auto_play') || 'open');
                GM_setValue('bpx_player_profile', window.localStorage.getItem('bpx_player_profile') || '{"lastView":' + (Date.now() - 86400000) + ',"lastUid":0}');
            }, 100);
        }
    };

    /* ============================================================
     * 1. CSS 强制隐藏登录弹窗
     * ============================================================ */
    var CSS_HIDE = [
        '.bili-mini-mask','.bili-mini-login','#bili-mini-login','.bili-mini',
        '.login-panel-ctnr','.login-panel','#login-panel',
        '.login-card-wrp','.login-card','.login-modal','.login-mask',
        '.login-dialog','.login-popup','.login-tip','.login-guide','.login-entry',
        '[class*="login-mask"]','[class*="loginMask"]','[class*="login-modal"]',
        '[class*="loginModal"]','[class*="login-dialog"]','[class*="loginDialog"]',
        '[class*="login-popup"]','[class*="loginPopup"]',
        '[id*="login-mask"]','[id*="loginMask"]','[id*="login-modal"]','[id*="loginModal"]',
        '.bili-mini-mask ~ .mask','[class*="backdrop"][class*="login"]',
        '.login-guide-pop','.login-toast','.login-bubble'
    ].join(',') + '{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;z-index:-1!important;}';
    CSS_HIDE += 'html,body{overflow:auto!important;overflow-x:hidden!important;position:static!important;width:auto!important;}';

    function injectCSS(css) {
        try { if (typeof GM_addStyle === 'function') { GM_addStyle(css); return; } } catch (e) {}
        function doInject() {
            var parent = document.head || document.documentElement;
            if (!parent) { setTimeout(doInject, 10); return; }
            var style = document.createElement('style');
            style.textContent = css;
            style.setAttribute('data-script', 'bili-enhance');
            parent.appendChild(style);
        }
        doInject();
    }
    injectCSS(CSS_HIDE);

    /* document-start 立即安装数据/网络劫持 */
    unlockComments();
    forceMaxQuality();
    installTrialBypass();

    /* ============================================================
     * 2. 登录弹窗清理
     * ============================================================ */
    var LOGIN_KEYWORDS = [
        'bili-mini','login-panel','login-card','login-modal','login-mask',
        'login-dialog','login-popup','login-guide','login-tip','login-toast',
        'login-bubble','login-entry','mini-login','minilogin','loginmask',
        'loginmodal','logindialog','loginpopup'
    ];

    function isLoginNode(node) {
        if (!node || node.nodeType !== 1) return false;
        var id = (node.id || '').toLowerCase();
        var cls = (typeof node.className === 'string' ? node.className : '').toLowerCase();
        for (var i = 0; i < LOGIN_KEYWORDS.length; i++) {
            if (id.indexOf(LOGIN_KEYWORDS[i]) >= 0 || cls.indexOf(LOGIN_KEYWORDS[i]) >= 0) return true;
        }
        return false;
    }

    function removeLoginNode(node) {
        try {
            if (node && node.parentNode) node.parentNode.removeChild(node);
            else if (node) node.style.display = 'none';
        } catch (e) {}
    }

    function unlockScroll() {
        var body = document.body, html = document.documentElement;
        if (!body || !html) return;
        var locked = body.classList.contains('bili-mini-mask-open')
            || body.classList.contains('lock-screen')
            || body.classList.contains('overflow-hidden')
            || body.style.overflow === 'hidden'
            || html.style.overflow === 'hidden';
        if (!locked) return;
        body.classList.remove('bili-mini-mask-open','lock-screen','overflow-hidden');
        html.classList.remove('bili-mini-mask-open','lock-screen');
        body.style.overflow = ''; html.style.overflow = '';
        body.style.position = ''; html.style.position = '';
    }

    var SWEEP_SELECTORS = [
        '.bili-mini-mask','.bili-mini-login','#bili-mini-login','.bili-mini',
        '.login-panel-ctnr','.login-panel','.login-card-wrp','.login-card',
        '.login-modal','.login-mask','.login-dialog','.login-popup',
        '.login-guide','.login-toast','.login-bubble'
    ];

    function sweep(root) {
        if (!root || !root.querySelectorAll) return;
        for (var i = 0; i < SWEEP_SELECTORS.length; i++) {
            var found = root.querySelectorAll(SWEEP_SELECTORS[i]);
            for (var j = 0; j < found.length; j++) removeLoginNode(found[j]);
        }
        unlockScroll();
    }

    /* MutationObserver：250ms 节流 */
    var observerTimer = null, observerDirty = false;
    var observer = new MutationObserver(function () {
        observerDirty = true;
        if (observerTimer) return;
        observerTimer = setTimeout(function () {
            observerTimer = null;
            if (!observerDirty) return;
            observerDirty = false;
            observer.disconnect();
            sweep(document.documentElement);
            observer.observe(document.documentElement, {
                childList: true, subtree: true,
                attributes: true, attributeFilter: ['class','id']
            });
        }, 250);
    });

    function startObserver() {
        observer.observe(document.documentElement, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['class','id']
        });
    }

    /* ============================================================
     * 3. Hook 登录触发函数 + 阻止点击登录
     * ============================================================ */
    function hookLoginTriggers() {
        var w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        var blocked = [
            'openLogin','showLogin','showLoginPanel','openLoginPanel',
            'showLoginDialog','openLoginDialog','showMiniLogin','openMiniLogin',
            'showLoginModal','openLoginModal','loginPanel','toLogin','goLogin','jumpLogin'
        ];
        blocked.forEach(function (name) {
            try {
                if (typeof w[name] === 'function') {
                    w[name] = function () { return false; };
                }
            } catch (e) {}
        });
        try {
            var origDispatch = w.dispatchEvent;
            w.dispatchEvent = function (event) {
                if (event && event.type && /login/i.test(event.type)) return false;
                return origDispatch.apply(this, arguments);
            };
        } catch (e) {}
        try {
            var origAdd = w.addEventListener;
            w.addEventListener = function (type, listener, options) {
                if (type && /login/i.test(type)) return;
                return origAdd.apply(this, arguments);
            };
        } catch (e) {}
    }

    function blockClickTriggers() {
        document.addEventListener('click', function (e) {
            var el = e.target;
            while (el && el !== document.body) {
                var cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
                var id = (el.id || '').toLowerCase();
                if (/login|to-login|goto-login/.test(cls) || /login/.test(id)) {
                    if (/登录后|登录以|登录才能/.test(el.textContent || '')) {
                        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                        return false;
                    }
                }
                el = el.parentElement;
            }
        }, true);
    }

    /* ============================================================
     * 4. 未登录看全部评论
     * ============================================================ */
    function unlockComments() {
        var w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

        function hookBiliUser(bu) {
            if (!bu || bu.__commentHooked || typeof bu.get !== 'function') return;
            bu.__commentHooked = true;
            var orig = bu.get.bind(bu);
            bu.get = function () {
                return orig().then(function (r) {
                    if (r && (r.code === -101 || r.code === -102)) {
                        return { code: 0, message: 'OK', data: r.data };
                    }
                    return r;
                });
            };
        }

        var _bu = null;
        try {
            if (w.__BiliUser__) {
                hookBiliUser(w.__BiliUser__);
            } else {
                Object.defineProperty(w, '__BiliUser__', {
                    configurable: true,
                    get: function () { return _bu; },
                    set: function (v) {
                        _bu = v;
                        hookBiliUser(v);
                    }
                });
            }
        } catch (e) {}

        try {
            var origFetch = w.fetch.bind(w);
            w.fetch = function (input, init) {
                var url = typeof input === 'string' ? input : (input && input.url);
                if (url && /\/x\/v2\/reply\/(wbi\/main|main|reply)(\?|$)/.test(url)) {
                    if (init && init.credentials === 'include') {
                        var newInit = Object.assign({}, init, { credentials: 'omit' });
                        return origFetch(input, newInit);
                    }
                }
                return origFetch.apply(this, arguments);
            };
        } catch (e) {}
    }

    /* ============================================================
     * 5. 自动最高清晰度（保留 XHR/fetch 兜底 + 新增 defineProperty 优先）
     * ============================================================ */
    function isPlayurl(url) {
        if (!url) return false;
        var path = String(url).split('?')[0];
        return /\/x\/player\/(wbi\/)?playurl/.test(path);
    }

    function rewritePlayurlUrl(url) {
        try {
            var u = new URL(url, location.origin);
            u.searchParams.set('qn', '80');
            u.searchParams.set('fnval', '4032');
            u.searchParams.set('fourk', '1');
            return u.toString();
        } catch (e) {
            return url.replace(/([?&])qn=[^&]*/, '$1qn=80')
                      .replace(/([?&])fnval=[^&]*/, '$1fnval=4032')
                      .replace(/([?&])fourk=[^&]*/, '$1fourk=1');
        }
    }

    function setLocalStorageQuality() {
        try {
            var keys = ['bilibili_player_settings','player_settings','bpx_player_settings','bwp_player_settings'];
            for (var i = 0; i < keys.length; i++) {
                try {
                    var raw = localStorage.getItem(keys[i]);
                    if (raw) {
                        var s = JSON.parse(raw);
                        s.video_quality = 80; s.quality = 80;
                        if (s.player) s.player.quality = 80;
                        localStorage.setItem(keys[i], JSON.stringify(s));
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }

    function hijackPlayurlResponse(data) {
        if (!data || !data.data) return data;
        var d = data.data;
        var maxQ = 0;
        if (d.durl && d.durl.length > 0) maxQ = d.quality || 80;
        if ((!maxQ) && Array.isArray(d.accept_quality) && d.accept_quality.length > 0) {
            maxQ = Math.max.apply(null, d.accept_quality);
        }
        if (maxQ) d.quality = maxQ;
        if (Array.isArray(d.accept_quality)) d.accept_quality.sort(function (a, b) { return b - a; });
        console.log('[B站增强] 清晰度响应: ' + (QN_LABELS[maxQ] || maxQ)
            + ' 格式=' + (d.format || '?')
            + ' 可用=[' + (d.accept_quality || []).map(function(q){return QN_LABELS[q]||q;}).join(',') + ']');
        return data;
    }

    function hijackPlayinfo() {
        var _play, _state, _origPlay;

        function doReplace() {
            if (!_state || !_origPlay) return;
            try {
                var v = _state.videoData;
                if (!v || !v.bvid || !v.cid) return;
                var u = 'https://api.bilibili.com/x/player/playurl?bvid=' + v.bvid
                    + '&cid=' + v.cid + '&qn=80&fnval=4032&fourk=1';
                var xhr = new XMLHttpRequest();
                xhr.open('GET', u, false);
                xhr.send(null);
                var hq = JSON.parse(xhr.responseText);
                if (hq.code === 0 && hq.data && hq.data.durl && hq.data.durl.length) {
                    _play = hq;
                    console.log('[B站增强] 内联播放信息已升级为 '
                        + (QN_LABELS[hq.data.quality] || hq.data.quality));
                }
            } catch (e) {}
        }

        try {
            Object.defineProperty(window, '__playinfo__', {
                configurable: true,
                get: function () { return _play; },
                set: function (p) { _origPlay = p; _play = p; doReplace(); }
            });
        } catch (e) {}
        try {
            Object.defineProperty(window, '__INITIAL_STATE__', {
                configurable: true,
                get: function () { return _state; },
                set: function (s) { _state = s; doReplace(); }
            });
        } catch (e) {}
    }

    function forceMaxQuality() {
        setLocalStorageQuality();
        hijackPlayinfo();

        // Hook XHR
        try {
            var origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url) {
                this.__isPlayurl = isPlayurl(url);
                if (this.__isPlayurl) {
                    try {
                        var newUrl = rewritePlayurlUrl(url);
                        arguments[1] = newUrl;
                        this.__url = newUrl;
                    } catch (e) {}
                }
                return origOpen.apply(this, arguments);
            };
            var origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function () {
                if (this.__isPlayurl) {
                    var self = this;
                    var doHijack = function () {
                        if (self.readyState === 4 && self.status === 200 && !self.__hijacked) {
                            try {
                                var data = JSON.parse(self.responseText);
                                hijackPlayurlResponse(data);
                                var text = JSON.stringify(data);
                                Object.defineProperty(self, 'responseText', { value: text, configurable: true });
                                Object.defineProperty(self, 'response', { value: text, configurable: true });
                                self.__hijacked = true;
                            } catch (e) {}
                        }
                    };
                    this.addEventListener('readystatechange', doHijack);
                    this.addEventListener('load', doHijack);
                }
                return origSend.apply(this, arguments);
            };
        } catch (e) { console.log('[B站增强] XHR hook失败:', e.message); }

        // Hook fetch
        try {
            var origFetch = window.fetch;
            window.fetch = function (input, init) {
                var url = typeof input === 'string' ? input : (input && input.url);
                if (isPlayurl(url)) {
                    try {
                        var newUrl = rewritePlayurlUrl(url);
                        if (typeof input === 'string') input = newUrl;
                        else if (input && input.url) input = new Request(newUrl, init || input);
                        url = newUrl;
                    } catch (e) {}
                }
                return origFetch.call(this, input, init).then(function (response) {
                    if (isPlayurl(url) && response && response.ok) {
                        return response.clone().json().then(function (data) {
                            hijackPlayurlResponse(data);
                            return new Response(JSON.stringify(data), {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });
                        }).catch(function () { return response; });
                    }
                    return response;
                });
            };
        } catch (e) { console.log('[B站增强] fetch hook失败:', e.message); }
    }

    /* ============================================================
     * 6. 无限试看（v测试版核心：defineProperty + setTimeout + 自动点击）
     * ============================================================ */
    function installTrialBypass() {
        if (document.cookie.includes('DedeUserID')) return; // 已登录无需处理

        var w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

        // ① 劫持 isViewToday / isVideoAble，欺骗播放器"今天已试用过/视频可看"
        var origDefineProperty = Object.defineProperty;
        Object.defineProperty = function (obj, prop, descriptor) {
            if (prop === 'isViewToday' || prop === 'isVideoAble') {
                descriptor = {
                    get: function () { return true; },
                    enumerable: false,
                    configurable: true
                };
            }
            return origDefineProperty.call(this, obj, prop, descriptor);
        };

        // ② 劫持 setTimeout，把 30 秒试用到期弹窗改为 3000 秒（实际上永不触发）
        var origSetTimeout = w.setTimeout;
        w.setTimeout = function (func, delay) {
            if (delay === 30000) delay = 300000000;
            return origSetTimeout.call(this, func, delay);
        };

        // ③ 自动点击"免费试用"按钮
        setInterval(function () {
            var trialBtn = document.querySelector('.bpx-player-toast-confirm-login');
            if (!trialBtn) return;

            setTimeout(function () {
                trialBtn.click();
                console.log('[B站增强] 已自动点击试用按钮');

                // ④ 音画同步：暂停→等待"试用中"→恢复播放
                if (options.isWaitUntilHighQualityLoaded && w.player) {
                    var isPlaying = !w.player.mediaElement().paused;
                    if (isPlaying) w.player.mediaElement().pause();

                    var timer4Toast = setInterval(function () {
                        var toasts = Array.from(document.querySelectorAll('.bpx-player-toast-text'));
                        if (toasts.some(function (toast) { return toast.textContent.endsWith('试用中'); })) {
                            if (isPlaying) w.player.mediaElement().play();
                            clearInterval(timer4Toast);
                        }
                    }, 100);
                }

                // ⑤ 切换到偏好分辨率
                var preferQualityNum = ({ '1080': 80, '720': 64, '480': 32, '360': 16 })[options.preferQuality] || 80;
                setTimeout(function () {
                    if (w.player && w.player.getSupportedQualityList && w.player.getQuality) {
                        if (w.player.getSupportedQualityList().indexOf(preferQualityNum) >= 0
                            && preferQualityNum < w.player.getQuality().nowQ) {
                            w.player.requestQuality(preferQualityNum);
                            console.log('[B站增强] 已切换至 ' + options.preferQuality + 'P');
                        }
                    }
                }, 5000);
            }, 1000);
        }, 1500);
    }

    /* ============================================================
     * 7. 设置面板（移植自 v测试版）
     * ============================================================ */
    function setupSettingPanel() {
        var style = document.createElement('style');
        style.textContent = `
            #userscript-467511-setting-panel-container {
                position: fixed; top: 0; left: 0; z-index: 999999999;
                width: 100vw; height: 100vh; display: none;
                flex-direction: column; justify-content: center; align-items: center;
                background-color: rgba(0,0,0,0.5);
            }
            .userscript-467511-setting-panel-wrapper {
                width: 600px; padding: 16px; display: flex; flex-direction: column;
                background-color: #FFFFFF; border-radius: 8px; user-select: none;
            }
            .userscript-467511-setting-panel-title {
                margin-top: 0; margin-bottom: 8px;
                padding-top: 16px; padding-left: 12px; font-size: 28px;
            }
            .userscript-467511-setting-panel-option-group {
                display: flex; flex-direction: column; width: 100%; font-size: 16px;
            }
            .userscript-467511-setting-panel-option-item {
                padding: 16px 16px; display: flex;
                justify-content: space-between; align-items: center; border-radius: 4px;
            }
            .userscript-467511-setting-panel-option-item:hover { background-color: #FAFAFA; }
            .userscript-467511-setting-panel-option-item-switch {
                display: flex; align-items: center;
                width: 40px; height: 20px; padding: 2px; cursor: pointer; border-radius: 4px;
            }
            .userscript-467511-setting-panel-option-item-switch[data-status="off"] {
                justify-content: flex-start; background-color: #CCCCCC;
            }
            .userscript-467511-setting-panel-option-item-switch[data-status="on"] {
                justify-content: flex-end; background-color: #00AEEC;
            }
            .userscript-467511-setting-panel-option-item-switch:after {
                content: ''; width: 20px; height: 20px;
                background-color: #FFFFFF; border-radius: 4px;
            }
            #userscript-467511-setting-panel-close-btn {
                margin-top: 16px; padding: 2px;
                width: 20px; height: 20px; display: flex;
                justify-content: center; align-items: center;
                font-size: 20px; color: #FFFFFF;
                border: 2px solid #FFFFFF; border-radius: 100%;
                cursor: pointer; user-select: none;
            }
        `;

        var container = document.createElement('div');
        container.id = 'userscript-467511-setting-panel-container';
        container.innerHTML = `
            <div class="userscript-467511-setting-panel-wrapper">
                <p class="userscript-467511-setting-panel-title">自定义设置</p>
                <div class="userscript-467511-setting-panel-option-group">
                    <div class="userscript-467511-setting-panel-option-item">
                        <span class="userscript-467511-setting-panel-option-item-title">偏好分辨率</span>
                        <select class="userscript-467511-setting-panel-option-item-select" data-key="preferQuality" name="preferQuality">
                            <option value="1080" ${options.preferQuality === '1080' ? 'selected' : ''}>1080p</option>
                            <option value="720" ${options.preferQuality === '720' ? 'selected' : ''}>720p</option>
                            <option value="480" ${options.preferQuality === '480' ? 'selected' : ''}>480p</option>
                            <option value="360" ${options.preferQuality === '360' ? 'selected' : ''}>360p</option>
                        </select>
                    </div>
                    <div class="userscript-467511-setting-panel-option-item">
                        <span class="userscript-467511-setting-panel-option-item-title">暂停播放视频直至画质切换完成(以此规避音画不同步现象)</span>
                        <span class="userscript-467511-setting-panel-option-item-switch" data-key="isWaitUntilHighQualityLoaded" data-status="${options.isWaitUntilHighQualityLoaded ? 'on' : 'off'}"></span>
                    </div>
                </div>
                <div style="margin-top:16px;align-self:center;font-size:14px;">
                    <span style="display:inline-block;transform:translateY(-1.5px);">⚠️</span>
                    <span style="color:#AAAAAA;">所有改动将在页面刷新后生效</span>
                </div>
            </div>
            <span id="userscript-467511-setting-panel-close-btn">×</span>
        `;

        container.querySelectorAll('.userscript-467511-setting-panel-option-item-select').forEach(function (select) {
            select.onchange = function (e) {
                var key = this.dataset.key;
                GM_setValue(key, e.target.value);
            };
        });

        container.querySelectorAll('.userscript-467511-setting-panel-option-item-switch').forEach(function (sw) {
            sw.onclick = function (e) {
                var key = this.dataset.key;
                var status = this.dataset.status;
                this.dataset.status = status === 'off' ? 'on' : 'off';
                GM_setValue(key, this.dataset.status === 'on');
            };
        });

        container.querySelector('#userscript-467511-setting-panel-close-btn').onclick = function () {
            container.style.display = 'none';
        };

        var timer = setInterval(function () {
            if (document.head && document.body) {
                document.head.appendChild(style);
                document.body.appendChild(container);
                clearInterval(timer);
            }
        }, 1000);
    }

    function setupSettingPanelEntry() {
        var timer = setInterval(function () {
            var otherSetting = document.querySelector('.bpx-player-ctrl-setting-others-content');
            if (otherSetting) {
                var entry = document.createElement('div');
                entry.textContent = '脚本设置 >';
                entry.style = 'height:20px;line-height:20px;cursor:pointer;';
                entry.onclick = function () {
                    document.querySelector('#userscript-467511-setting-panel-container').style.display = 'flex';
                };
                otherSetting.appendChild(entry);
                clearInterval(timer);
            }
        }, 1000);
    }

    /* ============================================================
     * 7. 状态浮层（视频右上角，显示当前分辨率，可点击关闭）
     * ============================================================ */
    function showStatusPanel() {
        try {
            var panel = document.createElement('div');
            panel.style.cssText = 'position:absolute;top:8px;right:8px;z-index:999999;background:rgba(0,0,0,0.7);color:#0f0;padding:4px 10px;border-radius:4px;font-size:12px;font-family:monospace;cursor:pointer;line-height:1.5;pointer-events:auto;';
            panel.title = '点击关闭';
            function update() {
                var v = document.querySelector('video');
                var h = v && v.videoHeight ? v.videoHeight : 0;
                panel.textContent = 'B站增强 v' + VERSION + ' | ' + (h ? h + 'p' : '加载中…');
            }
            panel.onclick = function () { clearInterval(t); panel.remove(); };
            update();
            var t = setInterval(update, 2000);

            // 找到视频容器并附加
            function attachToVideo() {
                // 优先找 bpx-player 容器，其次 video 元素的父容器
                var container = document.querySelector('.bpx-player-container')
                    || document.querySelector('.bilibili-player-video-wrap')
                    || document.querySelector('#bilibili-player')
                    || (document.querySelector('video') && document.querySelector('video').parentElement);
                if (container) {
                    // 确保容器有定位上下文
                    var style = window.getComputedStyle(container);
                    if (style.position === 'static') {
                        container.style.position = 'relative';
                    }
                    container.appendChild(panel);
                } else {
                    setTimeout(attachToVideo, 500);
                }
            }
            attachToVideo();
        } catch (e) {}
    }

    /* ============================================================
     * 8. 设置面板
     * ============================================================ */
    function compareVersion(v1, v2) {
        var a = String(v1).split('.').map(Number);
        var b = String(v2).split('.').map(Number);
        for (var i = 0; i < Math.max(a.length, b.length); i++) {
            var x = a[i] || 0, y = b[i] || 0;
            if (x > y) return 1;
            if (x < y) return -1;
        }
        return 0;
    }

    function checkLocalUpdate() {
        var current = VERSION;
        try {
            if (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) {
                current = GM_info.script.version;
            }
        } catch (e) {}
        var file = 'file:///D:/备份/脚本猫/自写脚本/bilibili禁登录弹窗-最高清-无限试看_latest.user.js';
        try {
            if (typeof GM_xmlhttpRequest !== 'function') return;
            GM_xmlhttpRequest({
                method: 'GET', url: file,
                onload: function (res) {
                    var m = (res.responseText || '').match(/@version\s+([\d.]+)/);
                    if (!m) return;
                    var local = m[1];
                    if (compareVersion(local, current) > 0) {
                        console.log('[B站增强] 发现新版本 v' + local + '（当前 v' + current + '）');
                        try { window.open(file, '_blank'); } catch (e) {}
                        showUpdateToast(local, current);
                    }
                },
                onerror: function () {}
            });
        } catch (e) {}
    }

    function showUpdateToast(newVer, oldVer) {
        try {
            var toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:#fb7299;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;';
            toast.textContent = 'B站脚本已更新到 v' + newVer + '（原 v' + oldVer + '），点击刷新页面生效';
            toast.onclick = function () { location.reload(); };
            document.body.appendChild(toast);
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 15000);
        } catch (e) {}
    }

    /* ============================================================
     * 9. 启动
     * ============================================================ */
    function init() {
        sweep(document.documentElement);
        startObserver();
        hookLoginTriggers();
        blockClickTriggers();
        setupSettingPanel();
        setupSettingPanelEntry();
        showStatusPanel();
        checkLocalUpdate();

        // SPA 路由变化时重新清理
        var lastUrl = location.href;
        setInterval(function () {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(function () { sweep(document.documentElement); }, 300);
            }
        }, 1000);

        console.log('[B站增强] 已启动 v' + VERSION + '：登录弹窗屏蔽 | 自动最高清晰度 | 无限试看(新) | 未登录看全部评论 | 自动更新');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
    if (document.documentElement) sweep(document.documentElement);
})();
