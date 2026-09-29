// ==UserScript==
// @name         自动登录CSDN
// @namespace    https://csdn-download.local
// @version      1.5.0
// @description  CSDN下载页辅助：移除登录弹窗/遮罩、提取真实文件地址；未登录时后台API静默登录（API变动自动发现新地址），失败再跳登录页自动填账密
// @author       自写脚本
// @match        *://download.csdn.net/*
// @match        *://blog.csdn.net/*/article/details/*
// @match        *://passport.csdn.net/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      passport.csdn.net
// @connect      csdnimg.cn
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/690743321/my-userscripts/main/自动登录CSDN_latest.user.js
// @downloadURL  https://raw.githubusercontent.com/690743321/my-userscripts/main/自动登录CSDN_latest.user.js
// ==/UserScript==

(function () {
    'use strict';

    var VERSION = '1.5.0';

    /* ============================================================
     * 账号配置：不内置账密，需通过脚本菜单「设置账号密码」自行填写
     * ============================================================ */
    function getAccount() {
        var u = '', p = '';
        try {
            if (typeof GM_getValue === 'function') {
                u = GM_getValue('csdn_user', '');
                p = GM_getValue('csdn_pwd', '');
            }
        } catch (e) {}
        return { user: u, pwd: p };
    }

    function hasAccount() {
        var acc = getAccount();
        return !!(acc.user && acc.pwd);
    }

    var HOST = location.hostname;

    /* ============================================================
     * 通用工具
     * ============================================================ */
    // 原生赋值（兼容 React/Vue 受控输入框）
    function setNativeValue(el, value) {
        try {
            var proto = el.__proto__;
            var desc = Object.getOwnPropertyDescriptor(proto, 'value');
            if (desc && desc.set) {
                desc.set.call(el, value);
            } else {
                el.value = value;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            el.value = value;
        }
    }

    function isLoggedIn() {
        // CSDN 登录后的特征 Cookie
        var c = document.cookie || '';
        return c.indexOf('UserToken=') >= 0 || c.indexOf('UserName=') >= 0;
    }

    function showTip(text, color) {
        var old = document.getElementById('csdn-dl-tip');
        if (old) old.parentNode.removeChild(old);
        var tip = document.createElement('div');
        tip.id = 'csdn-dl-tip';
        tip.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999999;' +
            'background:' + (color || 'rgba(20,20,30,0.95)') + ';color:#fff;padding:12px 22px;border-radius:8px;' +
            'font:14px/1.5 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
        tip.textContent = text;
        (document.body || document.documentElement).appendChild(tip);
        return tip;
    }

    /* ============================================================
     * A. 登录页逻辑：自动填账密 + 自动点登录
     * ============================================================ */
    function runLoginPage() {
        console.log('[CSDN-DL] 登录页，准备自动登录');
        if (!hasAccount()) {
            setTimeout(showAccountTip, 500);
            return;
        }
        var filled = false;
        var clicked = false;

        function tryFillAndLogin() {
            // 找账号框：可见的非密码文本框
            var userInput = null;
            var inputs = document.querySelectorAll('input');
            for (var i = 0; i < inputs.length; i++) {
                var inp = inputs[i];
                var t = (inp.type || '').toLowerCase();
                if (t === 'password') continue;
                if (t !== 'text' && t !== 'tel' && t !== 'email' && t !== '') continue;
                var ph = (inp.placeholder || '') + (inp.name || '') + (inp.id || '');
                if (/账号|手机号|邮箱|用户名|user|account|phone|email|login/i.test(ph) || !userInput) {
                    userInput = inp;
                    if (/账号|手机号|邮箱|用户名|user|account/i.test(ph)) break;
                }
            }
            // 找密码框
            var pwdInput = document.querySelector('input[type="password"]');

            if (userInput && pwdInput && !filled) {
                filled = true;
                var acc = getAccount();
                setNativeValue(userInput, acc.user);
                setNativeValue(pwdInput, acc.pwd);
                console.log('[CSDN-DL] 已填写账密');
                showTip('已自动填写账密，正在登录…');
                setTimeout(clickLogin, 600);
            }
        }

        function clickLogin() {
            if (clicked) return;
            // 找登录按钮：button 或含"登录"文字的可点元素
            var candidates = document.querySelectorAll('button, [class*="log"], [class*="btn"], a');
            for (var i = 0; i < candidates.length; i++) {
                var el = candidates[i];
                var txt = (el.textContent || '').trim();
                if (txt === '登录' || txt === '登 录' || /^登\s*录$/.test(txt)) {
                    // 排除"登录/注册"导航链接（通常在登录页顶部）
                    if (el.closest && el.closest('.toolbar, nav, header')) continue;
                    clicked = true;
                    el.click();
                    console.log('[CSDN-DL] 已点击登录按钮');
                    watchLoginResult();
                    return;
                }
            }
        }

        function watchLoginResult() {
            var n = 0;
            var timer = setInterval(function () {
                n++;
                // 离开登录页 = 登录成功
                if (location.hostname !== 'passport.csdn.net') {
                    clearInterval(timer);
                    return;
                }
                // 检测验证码/滑块出现
                var captcha = document.querySelector('[class*="captcha"], [class*="verify"], [class*="slide"], [id*="captcha"], [class*="geetest"], [class*="nc_"]');
                if (captcha) {
                    clearInterval(timer);
                    showTip('出现验证码/滑块，请手动完成验证', 'rgba(200,80,20,0.95)');
                    return;
                }
                if (n > 10) { // 10 秒后仍在登录页
                    clearInterval(timer);
                    showTip('自动登录未完成，请检查是否需要验证码或手动登录', 'rgba(200,80,20,0.95)');
                }
            }, 1000);
        }

        // 等 DOM 出现输入框
        var mo = new MutationObserver(function () {
            tryFillAndLogin();
        });
        function startObs() {
            if (document.documentElement) {
                mo.observe(document.documentElement, { childList: true, subtree: true });
            }
            tryFillAndLogin();
            setTimeout(tryFillAndLogin, 1000);
            setTimeout(tryFillAndLogin, 2500);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startObs);
        } else {
            startObs();
        }
    }

    /* ============================================================
     * B. 内容页逻辑：登录态检测 + 去弹窗 + 提取地址
     * ============================================================ */
    var LOGIN_SELECTORS = [
        '.passport-login-container',
        '.passport-login-pop-container',
        '[class*="login-modal"]',
        '[class*="login-dialog"]',
        '[class*="login-mask"]',
        '[id*="passport-login"]'
    ];

    function injectCSS() {
        var css = LOGIN_SELECTORS.join(',') + '{display:none!important;visibility:hidden!important;}';
        css += 'body{overflow:auto!important;}';
        try {
            if (typeof GM_addStyle === 'function') { GM_addStyle(css); return; }
        } catch (e) {}
        function doInject() {
            var parent = document.head || document.documentElement;
            if (!parent) { setTimeout(doInject, 10); return; }
            var style = document.createElement('style');
            style.textContent = css;
            style.setAttribute('data-script', 'csdn-dl');
            parent.appendChild(style);
        }
        doInject();
    }

    function removeLoginPopups() {
        for (var i = 0; i < LOGIN_SELECTORS.length; i++) {
            var els = document.querySelectorAll(LOGIN_SELECTORS[i]);
            for (var j = 0; j < els.length; j++) {
                try { els[j].parentNode && els[j].parentNode.removeChild(els[j]); } catch (e) {}
            }
        }
        try {
            document.documentElement.style.setProperty('overflow', 'auto', 'important');
            if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
        } catch (e) {}
    }

    function installRedirectBlocker() {
        var _open = window.open;
        window.open = function (url) {
            if (url && String(url).indexOf('passport.csdn.net') >= 0) {
                console.log('[CSDN-DL] 拦截登录页弹窗:', url);
                return null;
            }
            return _open.apply(this, arguments);
        };
    }

    function extractDownloadUrl() {
        try {
            var state = window.__INITIAL_STATE__ || window.__NUXT__ || {};
            var found = [];
            JSON.stringify(state, function (k, v) {
                if (typeof v === 'string' &&
                    (v.indexOf('.zip') >= 0 || v.indexOf('.rar') >= 0 ||
                     v.indexOf('.7z') >= 0 || v.indexOf('.pdf') >= 0 ||
                     v.indexOf('.tar') >= 0 || v.indexOf('.gz') >= 0) &&
                    (v.indexOf('http') === 0)) {
                    found.push(v);
                }
                return v;
            });
            var scripts = document.querySelectorAll('script');
            for (var i = 0; i < scripts.length; i++) {
                var text = scripts[i].textContent || '';
                var m = text.match(/"((?:https?:)?\/\/[^"]*?\.(?:zip|rar|7z|pdf|tar|gz)[^"]*)"/i);
                if (m && m[1]) found.push(m[1]);
            }
            return found.length ? found[0] : null;
        } catch (e) {
            return null;
        }
    }

    // 设置面板（通过脚本猫菜单"设置账号密码"打开）
    function showSettingsPanel() {
        var old = document.getElementById('csdn-dl-settings');
        if (old) old.parentNode.removeChild(old);
        var acc = getAccount();
        var mask = document.createElement('div');
        mask.id = 'csdn-dl-settings';
        mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999999;' +
            'background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
        mask.innerHTML =
            '<div style="background:#1e1e28;color:#eee;padding:22px 24px;border-radius:12px;width:320px;' +
            'font:14px/1.6 sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.5);">' +
            '<div style="font-weight:bold;font-size:15px;margin-bottom:14px;color:#7fd4ff;">CSDN免登录下载 设置 v' + VERSION + '</div>' +
            '<div style="margin-bottom:6px;color:#aaa;">账号</div>' +
            '<input id="csdn-set-user" type="text" style="width:100%;box-sizing:border-box;padding:8px 10px;' +
            'border-radius:6px;border:1px solid #444;background:#14141c;color:#eee;margin-bottom:12px;outline:none;" />' +
            '<div style="margin-bottom:6px;color:#aaa;">密码</div>' +
            '<input id="csdn-set-pwd" type="text" style="width:100%;box-sizing:border-box;padding:8px 10px;' +
            'border-radius:6px;border:1px solid #444;background:#14141c;color:#eee;margin-bottom:16px;outline:none;" />' +
            '<div style="text-align:right;">' +
            '<span id="csdn-set-cancel" style="cursor:pointer;color:#888;margin-right:16px;">取消</span>' +
            '<span id="csdn-set-save" style="cursor:pointer;background:#2a7;color:#fff;padding:6px 18px;border-radius:6px;">保存</span>' +
            '</div></div>';
        (document.body || document.documentElement).appendChild(mask);
        document.getElementById('csdn-set-user').value = acc.user;
        document.getElementById('csdn-set-pwd').value = acc.pwd;
        document.getElementById('csdn-set-save').onclick = function () {
            var u = document.getElementById('csdn-set-user').value.trim();
            var p = document.getElementById('csdn-set-pwd').value;
            try { GM_setValue('csdn_user', u); GM_setValue('csdn_pwd', p); } catch (e) {}
            mask.parentNode.removeChild(mask);
            removeAccountTip();
            showTip('账号已保存', 'rgba(30,150,60,0.95)');
            // 保存后若仍未登录，立即尝试登录；若在登录页则刷新触发自动填表
            if (location.hostname === 'passport.csdn.net') {
                setTimeout(function () { location.reload(); }, 600);
            } else if (!isLoggedIn()) {
                setTimeout(ensureLogin, 600);
            }
        };
        document.getElementById('csdn-set-cancel').onclick = function () {
            mask.parentNode.removeChild(mask);
        };
        mask.addEventListener('click', function (e) {
            if (e.target === mask) mask.parentNode.removeChild(mask);
        });
    }

    // 注册脚本猫菜单
    try {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('设置账号密码', showSettingsPanel);
        }
    } catch (e) {}

    // 未填账密时：网页右上角常驻提示，点击打开设置面板
    function showAccountTip() {
        if (document.getElementById('csdn-dl-noacc')) return;
        var tip = document.createElement('div');
        tip.id = 'csdn-dl-noacc';
        tip.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999999;' +
            'background:rgba(200,120,20,0.95);color:#fff;padding:10px 16px;border-radius:8px;' +
            'font:13px/1.5 sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        tip.textContent = '未设置 CSDN 账号密码，点击此处填写';
        tip.onclick = function () {
            tip.parentNode && tip.parentNode.removeChild(tip);
            showSettingsPanel();
        };
        (document.body || document.documentElement).appendChild(tip);
    }

    function removeAccountTip() {
        var tip = document.getElementById('csdn-dl-noacc');
        if (tip) tip.parentNode.removeChild(tip);
    }

    function enhanceDownloadButtons() {
        var btns = document.querySelectorAll('a[href*="download"], button, .download-btn, [class*="download"]');
        for (var i = 0; i < btns.length; i++) {
            (function (btn) {
                if (btn.__csdnDlHooked) return;
                btn.__csdnDlHooked = true;
                btn.addEventListener('click', function () {
                    setTimeout(removeLoginPopups, 300);
                    setTimeout(removeLoginPopups, 1000);
                }, true);
            })(btns[i]);
        }
    }

    // 后台 API 静默登录（逆向自官方登录页：明文密码 + 空风控 token）
    // 内置候选 API 列表（CSDN 改路径时自动逐个尝试）
    var API_CANDIDATES = [
        'https://passport.csdn.net/v1/register/pc/login/doLogin',
        'https://passport.csdn.net/register/pc/login/doLogin'
    ];

    // 向指定 API 发登录请求。回调 onResult(ok, msg, hardFail)
    //   ok=true 登录成功；hardFail=false 表示可尝试下一个候选（404/网络错等）
    function postLogin(apiUrl, onResult) {
        var acc = getAccount();
        GM_xmlhttpRequest({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            data: JSON.stringify({
                userIdentification: acc.user,
                pwdOrVerifyCode: acc.pwd,
                loginType: '1',
                webUmidToken: '',
                uaToken: '',
                agreedPrivacyPolicy: 1
            }),
            timeout: 12000,
            onload: function (res) {
                console.log('[CSDN-DL] 后台登录响应', apiUrl, 'HTTP', res.status, res.responseText);
                if (res.status === 404 || res.status === 521 || res.status === 502 || res.status === 503) {
                    onResult(false, 'HTTP ' + res.status, false); // API 可能已变动，可换下一个
                    return;
                }
                var data = null;
                try { data = JSON.parse(res.responseText); } catch (e) {}
                if (data && data.status) {
                    onResult(true, '', true);
                } else {
                    // 业务失败（密码错/要验证码）：换 URL 无意义，硬失败
                    var msg = (data && (data.message || data.msg)) || ('HTTP ' + res.status + ' 非JSON响应');
                    onResult(false, msg, true);
                }
            },
            onerror: function (e) {
                console.log('[CSDN-DL] 请求错误', apiUrl, e);
                onResult(false, 'network error', false);
            },
            ontimeout: function () { onResult(false, 'timeout', false); }
        });
    }

    // 动态发现最新登录 API：抓登录页 HTML → 找 loginv3.*.js → 从 JS 提取 pcDoLogin 路径
    function discoverApiUrl(callback) {
        console.log('[CSDN-DL] 开始动态发现登录 API…');
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://passport.csdn.net/login',
            timeout: 12000,
            onload: function (res) {
                var m = res.responseText.match(/src="(https?:\/\/[^"]*loginv3[^"]*\.js)"/) ||
                        res.responseText.match(/src="(https?:\/\/[^"]*login[^"]*\.js)"/);
                if (!m) { console.log('[CSDN-DL] 未发现登录 JS'); callback(null); return; }
                console.log('[CSDN-DL] 登录 JS:', m[1]);
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: m[1],
                    timeout: 15000,
                    onload: function (res2) {
                        var m2 = res2.responseText.match(/pcDoLogin\s*:\s*"([^"]+)"/);
                        if (!m2) { console.log('[CSDN-DL] JS 中未找到 pcDoLogin'); callback(null); return; }
                        var path = m2[1];
                        var url = path.indexOf('http') === 0 ? path : 'https://passport.csdn.net' + path;
                        console.log('[CSDN-DL] 发现最新 API:', url);
                        callback(url);
                    },
                    onerror: function () { callback(null); },
                    ontimeout: function () { callback(null); }
                });
            },
            onerror: function () { callback(null); },
            ontimeout: function () { callback(null); }
        });
    }

    function tryApiLogin(onFail) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            onFail('GM_xmlhttpRequest 不可用');
            return;
        }
        showTip('未登录，正在后台静默登录…');

        // 构建尝试队列：localStorage 缓存的上次成功地址 → 内置候选
        var queue = [];
        var cached = null;
        try { cached = localStorage.getItem('csdn_dl_api_url'); } catch (e) {}
        if (cached) queue.push(cached);
        for (var i = 0; i < API_CANDIDATES.length; i++) {
            if (queue.indexOf(API_CANDIDATES[i]) < 0) queue.push(API_CANDIDATES[i]);
        }

        function onSuccess(apiUrl) {
            try { localStorage.setItem('csdn_dl_api_url', apiUrl); } catch (e) {}
            showTip('后台登录成功，刷新页面…', 'rgba(30,150,60,0.95)');
            setTimeout(function () { location.reload(); }, 800);
        }

        function tryNext() {
            if (!queue.length) {
                // 候选全失败 → 动态发现新 API
                discoverApiUrl(function (newUrl) {
                    if (!newUrl) { onFail('API 候选全部失败且动态发现无果'); return; }
                    if (API_CANDIDATES.indexOf(newUrl) >= 0 || newUrl === cached) {
                        onFail('动态发现的 API 与已失败地址相同'); return;
                    }
                    postLogin(newUrl, function (ok, msg) {
                        if (ok) onSuccess(newUrl);
                        else onFail('新发现的 API 也失败: ' + msg);
                    });
                });
                return;
            }
            var url = queue.shift();
            postLogin(url, function (ok, msg, hardFail) {
                if (ok) { onSuccess(url); return; }
                if (hardFail) { onFail(msg); return; }
                console.log('[CSDN-DL] 候选失败，尝试下一个:', url, msg);
                tryNext();
            });
        }
        tryNext();
    }

    // 未登录 → 先尝试后台 API 登录，失败再跳登录页（防死循环：60 秒内只试一次）
    function ensureLogin() {
        if (isLoggedIn()) { removeAccountTip(); return; }
        if (!hasAccount()) { showAccountTip(); return; }
        var key = 'csdn_dl_last_redirect';
        var last = 0;
        try { last = parseInt(sessionStorage.getItem(key) || '0', 10); } catch (e) {}
        var now = Date.now();
        if (now - last < 60000) {
            console.log('[CSDN-DL] 未登录，但 60 秒内已尝试过（防循环）');
            return;
        }
        try { sessionStorage.setItem(key, String(now)); } catch (e) {}
        tryApiLogin(function (reason) {
            console.log('[CSDN-DL] 后台登录不可用（' + reason + '），回退跳登录页');
            showTip('后台登录失败，跳转登录页自动登录…');
            setTimeout(function () {
                location.href = 'https://passport.csdn.net/login?from=' + encodeURIComponent(location.href);
            }, 800);
        });
    }

    function initContentPage() {
        console.log('[CSDN-DL] 已加载 v' + VERSION);
        injectCSS();
        installRedirectBlocker();
        removeLoginPopups();
        enhanceDownloadButtons();
        setTimeout(ensureLogin, 1500);
    }

    /* ============================================================
     * 主路由
     * ============================================================ */
    if (HOST === 'passport.csdn.net') {
        runLoginPage();
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initContentPage);
        } else {
            initContentPage();
        }

        if ('MutationObserver' in window) {
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes.length) {
                        removeLoginPopups();
                        enhanceDownloadButtons();
                        break;
                    }
                }
            });
            function startMainObs() {
                if (document.documentElement) {
                    observer.observe(document.documentElement, { childList: true, subtree: true });
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startMainObs);
            } else {
                startMainObs();
            }
        }
    }
})();
