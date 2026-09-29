// ==UserScript==
// @name         全站广告屏蔽
// @namespace    https://adblock.local
// @version      1.1.4
// @description  通用广告屏蔽脚本：隐藏广告元素、移除全屏遮罩、拦截广告跳转与弹窗、屏蔽广告网络请求。支持所有网站。
// @author       自写脚本
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/690743321/my-userscripts/main/adblock_latest.user.js
// @downloadURL  https://raw.githubusercontent.com/690743321/my-userscripts/main/adblock_latest.user.js
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    var VERSION = '1.1.4';

    /* ============================================================
     * 配置区
     * ============================================================ */
    var CONFIG = {
        // 广告选择器关键词（id/class 中包含这些词的元素会被隐藏）
        // 注意：避免使用过短/过泛的词（如 ad、modal、overlay、recommend、related、banner），以免误伤正常内容
        adKeywords: [
            'ads', 'advert', 'advertisement',
            'sponsor', 'sponsored', 'promo', 'promotion', 'promote',
            'affiliate', 'tracking', 'pixel', 'beacon',
            'adslot', 'ad-slot', 'adslot_', 'gpt', 'googletag',
            'doubleclick', 'googlesyndication', 'googleads',
            'adform', 'criteo', 'taboola', 'outbrain', 'mgid',
            'adsense', 'admanager', 'adexchange',
            'ssp', 'dsp', 'rtb', 'header-bidding', 'prebid',
            'ad-container', 'ad_wrapper', 'ad-wrap', 'adblock',
            'vpaid', 'vast', 'video-ad', 'preroll', 'midroll',
            'interstitial', 'native-ad', 'nativead', 'in-feed',
            'sticky-ad', 'stickyad', 'bottom-ad', 'top-ad',
            'right-rail', 'right-rail-ad', 'skyscraper',
            'leaderboard', 'rectangle', 'halfpage', 'billboard'
        ],
        // 广告域名关键词（URL 中包含这些词的请求会被拦截）
        adDomainKeywords: [
            'doubleclick', 'googlesyndication', 'googleadservices', 'google-analytics',
            'googletagmanager', 'googleads', 'adform', 'criteo', 'taboola', 'outbrain',
            'mgid', 'adsrvr', 'adnxs', 'adzerk', 'adroll', 'adsnative', 'advertising',
            'adtech', 'adventori', 'affiliate', 'amazon-adsystem', 'moatads',
            'scorecardresearch', 'quantserve', 'scorecard', 'everesttech',
            'pubmatic', 'openx', 'rubicon', 'casalemedia', 'exelator',
            'adsymptotic', 'adbrn', 'addthis', 'sharethis', 'sailthru',
            'yieldmo', 'zemanta', 'contentad', 'contentads', 'disqusads',
            'mathtag', 'mediavoice', 'moatpixel', 'ad-verification',
            'adform.net', 'adtechus', 'celtra', 'dianomi', 'flashtalking',
            'innovid', 'jivox', 'jpdigital', 'mixpo', 'pointroll',
            'sizmek', 'snapads', 'speee', 'springServe', 'videoamp',
            'vindicosuite', 'visx', 'weborama', 'zemanta', 'zergnet',
            // B站广告系统
            'cm.bilibili.com'
        ],
        // 白名单：这些网站不启用屏蔽（可自行添加）
        whitelist: [
            'csdn.net'  // 临时：CSDN 页面结构特殊，通用规则误伤严重，待精准规则完成后移出
        ],
        // 站点专属 CSS 选择器（按域名匹配，命中的元素直接隐藏）
        siteSelectors: {
            'bilibili.com': [
                // 大会员/活动横幅
                '[class*="banner-ad"]', '[class*="vip-banner"]', '[class*="promo-banner"]',
                '[class*="top-banner"]', '[class*="header-banner"]', '[class*="ad-banner"]',
                '[class*="activity-banner"]', '[class*="floor-banner"]', '[class*="banner-link"]',
                '[class*="activity-entry"]', '[class*="vip-entry"]', '[class*="spread"]',
                '[class*="vip-card"]', '[class*="bigvip"]', '[class*="bili-vip"]',
                // 大会员促销广告（粉色横幅等）
                '[class*="vip-promo"]', '[class*="promo-card"]', '[class*="activity-card"]',
                '[class*="vip-shop"]', '[class*="bigo-vip"]', '[class*="vip-floor"]',
                // 关注按钮（视频详情页的"+关注"）
                '[class*="follow-btn"]', '[class*="follow-button"]',
                '[class*="video-follow"]', '[class*="action-follow"]',
                '[class*="player-follow"]', '[class*="top-follow"]',
                // 登录弹窗/遮罩（B站特有）
                '.bili-mini-mask', '.bili-mini-login', '#bili-mini-login', '.bili-mini',
                '[class*="login-panel"]', '[class*="login-modal"]', '[class*="login-dialog"]',
                '[class*="login-card"]', '[class*="login-popup"]', '[class*="login-mask"]',
                '[class*="loginMask"]', '[class*="loginModal"]', '[class*="login-panel-popover"]',
                // 登录诱导提示条（播放器内的"登录免费享高清"提示条本身）
                '[class*="login-tip-bar"]', '[class*="login-guide-bar"]',
                '[class*="player-login"]', '[class*="login-toast"]',
                // B站广告容器（信息流/侧边栏/横幅广告）
                '[class*="ad-report"]', '[class*="strip-ad"]', '[class*="left-banner"]',
                '[class*="ad-card"]', '[class*="ad-item"]', '[class*="ad-box"]',
                '[class*="ad-tag"]', '[class*="ad-entry"]', '[class*="ad-floor"]',
                // 试看提示/大会员诱导提示（播放器toast）
                '[class*="player-toast"]', '[class*="toast-wrap"]', '[class*="toast-auto"]'
            ],
            'douyin.com': [
                '[class*="ad-tag"]', '[class*="ad-card"]', '[class*="ad-item"]',
                '[class*="promotion-card"]', '[data-e2e*="ad"]', '[class*="xgplayer-ad"]',
                '[class*="ad-banner"]', '[class*="banner-ad"]', '[class*="ad-block"]',
                '[class*="feed-ad"]', '[class*="waterfall-ad"]'
            ],
            'weibo.com': [
                '[class*="card-ad"]', '[class*="ad-box"]', '[class*="spread"]'
            ],
            'zhihu.com': [
                '[class*="AdBanner"]', '[class*="ad-card"]', '[class*="Promotion"]',
                '[class*="TopstoryItem-isPromote"]'
            ]
        },
        // 广告文字标签：元素自身文本（非递归）出现这些短文本时视为广告角标
        adTextLabels: ['广告', '赞助', '推广', '赞助内容', '推广内容', 'Sponsored', 'Ad'],
        // 登录提示文本：包含这些文本的浮动条视为登录诱导并隐藏
        loginPromptTexts: ['登录免费享', '登录后查看', '登录后可', '立即登录享', '登录解锁', '试看30秒', '免费试看'],
        // 是否拦截弹窗跳转（window.open / location 跳转）
        blockRedirects: true,
        // 是否拦截网络广告请求
        blockNetwork: true,
        // 全屏遮罩检测阈值
        overlayThreshold: 0.85,
        // getAdContainer 最大上溯层数（防止爬到页面主容器导致整页黑屏）
        maxContainerClimb: 5
    };

    /* ============================================================
     * 工具函数
     * ============================================================ */
    function inWhitelist() {
        var host = location.hostname;
        for (var i = 0; i < CONFIG.whitelist.length; i++) {
            if (host.indexOf(CONFIG.whitelist[i]) >= 0) return true;
        }
        return false;
    }

    // 获取当前站点的专属选择器
    function getSiteSelectors() {
        var host = location.hostname;
        var keys = Object.keys(CONFIG.siteSelectors);
        var result = [];
        for (var i = 0; i < keys.length; i++) {
            if (host.indexOf(keys[i]) >= 0) {
                result = result.concat(CONFIG.siteSelectors[keys[i]]);
            }
        }
        return result;
    }

    /* ---------- 功能性元素保护（核心防误伤） ---------- */
    // 功能性标签：这些标签本身就是页面功能的一部分，绝不当作广告移除
    var FUNCTIONAL_TAGS = {
        INPUT: true, TEXTAREA: true, SELECT: true, BUTTON: true, FORM: true,
        LABEL: true, OPTION: true, FIELDSET: true, LEGEND: true,
        NAV: true, HEADER: true, FOOTER: true, MAIN: true, ASIDE: false,
        VIDEO: true, AUDIO: true, CANVAS: true, SVG: true, IMG: false,
        TABLE: true, THEAD: true, TBODY: true, TR: true, TH: true, TD: true,
        DETAILS: true, SUMMARY: true, DIALOG: true
    };

    // 功能性 class/id 关键词（用于元素“自身”判定，带词边界匹配）
    // 注意：不要放 'video'/'audio'/'canvas' 这类泛词——视频卡片(bili-video-card)会因此被误保护导致广告漏拦；
    // 真正的播放器由 <video> 标签与 'player'/'bpx-player' 类保护
    var FUNCTIONAL_KEYWORDS = [
        'search', 'searchbox', 'search-box', 'search_form', 'query',
        'nav', 'navbar', 'navigation', 'menu', 'menubar', 'scope',
        'header', 'footer', 'main', 'content', 'toolbar',
        'form', 'input', 'button', 'submit', 'login', 'signin', 'sign-in',
        'player', 'bpx-player',
        'table', 'comment', 'comments', 'reply',
        'pagination', 'pager', 'breadcrumb',
        'tab', 'tabs', 'accordion',
        'sidebar', 'side-bar'
    ];

    // 后代功能元素检测专用的“高精度”关键词（仅保留极少出现在广告/内容卡片中的词）
    // 结构性功能（input/button/form/nav/header/table/video 等）由标签与 role 选择器精确命中
    var FUNCTIONAL_DESC_KEYWORDS = [
        'search', 'navbar', 'navigation', 'menubar',
        'pagination', 'breadcrumb', 'player', 'sidebar', 'comment'
    ];

    // 判断元素自身是否是功能性元素（搜索框、菜单、导航、表单、播放器等）
    function isFunctionalElement(el) {
        if (!el || el.nodeType !== 1) return false;
        var tag = el.tagName;
        // 功能性标签直接判定
        if (FUNCTIONAL_TAGS[tag]) return true;
        // 检查 role 属性
        var role = el.getAttribute && el.getAttribute('role') || '';
        if (role === 'search' || role === 'navigation' || role === 'banner' ||
            role === 'contentinfo' || role === 'main' || role === 'form' ||
            role === 'button' || role === 'textbox' || role === 'combobox' ||
            role === 'menu' || role === 'menubar' || role === 'menuitem' ||
            role === 'tab' || role === 'tablist' || role === 'table' ||
            role === 'row' || role === 'cell' || role === 'columnheader') {
            return true;
        }
        // 检查 type 属性（input/button 等）
        var type = el.getAttribute && el.getAttribute('type') || '';
        if (type === 'search' || type === 'submit' || type === 'button' ||
            type === 'text' || type === 'textarea' || type === 'password' ||
            type === 'email' || type === 'tel' || type === 'url' || type === 'number') {
            return true;
        }
        // 检查 id/class 是否包含功能性关键词
        var id = (el.id || '').toLowerCase();
        var cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
        for (var i = 0; i < FUNCTIONAL_KEYWORDS.length; i++) {
            var kw = FUNCTIONAL_KEYWORDS[i];
            var re = new RegExp('(^|[^a-z])' + kw + '([^a-z]|$)');
            if (re.test(id) || re.test(cls)) return true;
        }
        return false;
    }

    // 判断元素是否包含功能性子元素（搜索框、菜单、导航、表单、播放器等）
    // 包含这些元素的容器绝不可移除，防止整页功能失效
    function containsFunctionalElement(el) {
        if (!el || el.nodeType !== 1) return false;
        // 检查自身
        if (isFunctionalElement(el)) return true;
        if (!el.querySelector) return false;
        // 检查功能性标签（精确）
        if (el.querySelector('input, textarea, select, button, form, label, video, audio, canvas, svg, table, nav, header, footer, main, dialog')) {
            return true;
        }
        // 检查带功能性 role 的元素（精确）
        var functionalEls = el.querySelectorAll('[role="search"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="main"], [role="form"], [role="textbox"], [role="combobox"], [role="menu"], [role="menubar"], [role="menuitem"], [role="tablist"], [role="tab"]');
        if (functionalEls.length > 0) return true;
        // 仅使用高精度关键词做后代匹配（避免 video/content/tab 等泛词误保护广告卡片）
        for (var i = 0; i < FUNCTIONAL_DESC_KEYWORDS.length; i++) {
            var kw = FUNCTIONAL_DESC_KEYWORDS[i];
            try {
                if (el.querySelector('[id*="' + kw + '"], [class*="' + kw + '"]')) return true;
            } catch (e) {}
        }
        return false;
    }

    /* ---------- 广告检测 ---------- */
    // 辅助：文本是否包含广告标签（文本需较短，避免误伤文章内容）
    function textHasAdLabel(text) {
        if (!text) return false;
        var t = text.trim();
        if (t.length === 0 || t.length > 10) return false; // 超过10字的不视为角标
        for (var i = 0; i < CONFIG.adTextLabels.length; i++) {
            var label = CONFIG.adTextLabels[i];
            if (/^[A-Za-z]+$/.test(label)) {
                // 英文标签必须整词匹配，避免 "Add"、"Admin" 等词被误伤
                var re = new RegExp('(^|[^A-Za-z])' + label + '([^A-Za-z]|$)');
                if (re.test(t)) return true;
            } else if (t === label || t.indexOf(label) >= 0) {
                return true;
            }
        }
        return false;
    }

    // 检测元素自身是否是广告文字角标（如"广告"、"赞助"短文本）
    // 只判断元素直接文本，不递归后代，避免顶层容器被误判
    function hasAdTextLabel(el) {
        if (!el || el.nodeType !== 1) return false;
        // 只取直接子文本节点的内容，不包含后代元素的文本
        var directText = '';
        for (var i = 0; i < el.childNodes.length; i++) {
            var cn = el.childNodes[i];
            if (cn.nodeType === 3) { // text node
                directText += cn.textContent;
            }
        }
        return textHasAdLabel(directText);
    }

    // 检测元素是否是登录诱导弹窗/提示条
    function hasLoginPromptText(el) {
        if (!el || el.nodeType !== 1) return false;
        var text = (el.textContent || '').trim();
        if (text.length > 80) return false; // 太长的不是提示条/弹窗
        for (var i = 0; i < CONFIG.loginPromptTexts.length; i++) {
            if (text.indexOf(CONFIG.loginPromptTexts[i]) >= 0) return true;
        }
        // 注意：移除"登录+注册"的宽泛检查，避免误伤正常文章内容（如CSDN文章中的登录/注册字样）
        return false;
    }

    function hasAdKeyword(str) {
        if (!str) return false;
        var s = String(str).toLowerCase();
        for (var i = 0; i < CONFIG.adKeywords.length; i++) {
            var kw = CONFIG.adKeywords[i];
            var re = new RegExp('(^|[^a-z])' + kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '([^a-z]|$)', 'i');
            if (re.test(s)) return true;
        }
        return false;
    }

    function isAdElement(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el === document.body || el === document.documentElement) return false;
        // 保护：功能性元素绝不判定为广告
        if (isFunctionalElement(el)) return false;
        // 保护：包含视频播放器的元素绝不移除
        if (containsVideoPlayer(el)) return false;
        var id = el.id || '';
        var cls = (typeof el.className === 'string') ? el.className : '';
        var name = el.getAttribute && el.getAttribute('name') || '';
        var role = el.getAttribute && el.getAttribute('role') || '';
        var dataAd = el.getAttribute && el.getAttribute('data-ad') || '';
        var ariaLabel = el.getAttribute && el.getAttribute('aria-label') || '';
        if (hasAdKeyword(id) || hasAdKeyword(cls) || hasAdKeyword(name) || hasAdKeyword(dataAd) || hasAdKeyword(ariaLabel)) {
            // 二次确认：如果元素包含功能性子元素，不当作广告
            if (containsFunctionalElement(el)) return false;
            return true;
        }
        if (role === 'dialog' && (hasAdKeyword(id) || hasAdKeyword(cls))) {
            if (containsFunctionalElement(el)) return false;
            return true;
        }
        // 文字标签检测（信息流广告带"广告"角标）
        if (hasAdTextLabel(el)) {
            // 广告角标本身通常是小元素，如果包含功能性子元素则不是角标
            if (containsFunctionalElement(el)) return false;
            return true;
        }
        // 链接 href 检测：仅链接元素自身参与
        if (el.tagName === 'A' && hasAdLink(el)) {
            return true;
        }
        // 登录诱导提示条（顶部导航栏的不屏蔽，播放器内的会精准移除提示条本身）
        if (hasLoginPromptText(el) && !isInTopNav(el)) {
            if (containsFunctionalElement(el)) return false;
            return true;
        }
        return false;
    }

    // 判断元素是否在视频播放器内（保护播放器不被误杀）
    function isInVideoPlayer(el) {
        var cur = el;
        for (var i = 0; i < 12 && cur && cur !== document.body; i++) {
            var tag = cur.tagName ? cur.tagName.toLowerCase() : '';
            var curCls = (typeof cur.className === 'string') ? cur.className.toLowerCase() : '';
            var curId = (cur.id || '').toLowerCase();
            if (tag === 'video' ||
                curCls.indexOf('player') >= 0 || curCls.indexOf('bpx-player') >= 0 ||
                curCls.indexOf('bilibili-player') >= 0 || curCls.indexOf('video-player') >= 0 ||
                curCls.indexOf('player-wrap') >= 0 || curCls.indexOf('player-box') >= 0 ||
                curId.indexOf('player') >= 0 || curId.indexOf('bpx-player') >= 0) {
                return true;
            }
            cur = cur.parentElement;
        }
        return false;
    }

    // 判断元素是否包含视频播放器（保护容器不被误杀）
    function containsVideoPlayer(el) {
        if (!el || el.nodeType !== 1) return false;
        var tag = el.tagName ? el.tagName.toLowerCase() : '';
        var cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
        if (tag === 'video' || cls.indexOf('player') >= 0 || cls.indexOf('bpx-player') >= 0) {
            return true;
        }
        if (el.querySelector) {
            if (el.querySelector('video')) return true;
            var playerEls = el.querySelectorAll('[class*="player"], [id*="player"]');
            if (playerEls.length > 0) return true;
        }
        return false;
    }

    // 检测元素自身或子元素的链接是否指向广告域名
    function hasAdLink(el) {
        if (!el || el.nodeType !== 1) return false;
        var href = '';
        if (el.tagName === 'A') {
            href = el.getAttribute('href') || el.href || '';
        }
        if (isAdUrl(href)) return true;
        var links = el.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            var lhref = links[i].getAttribute('href') || links[i].href || '';
            if (isAdUrl(lhref)) return true;
        }
        return false;
    }

    // 判断 URL 是否是广告域名
    function isAdUrl(url) {
        if (!url) return false;
        var lower = url.toLowerCase();
        for (var i = 0; i < CONFIG.adDomainKeywords.length; i++) {
            if (lower.indexOf(CONFIG.adDomainKeywords[i]) >= 0) return true;
        }
        return false;
    }

    // 判断元素是否在顶部导航栏内（保护登录入口不被误杀）
    function isInTopNav(el) {
        var cur = el;
        for (var i = 0; i < 8 && cur && cur !== document.body; i++) {
            var tag = cur.tagName ? cur.tagName.toLowerCase() : '';
            var curCls = (typeof cur.className === 'string') ? cur.className.toLowerCase() : '';
            var curId = (cur.id || '').toLowerCase();
            if (tag === 'header' || tag === 'nav' ||
                curCls.indexOf('header') >= 0 || curCls.indexOf('navbar') >= 0 ||
                curId.indexOf('header') >= 0 || curId.indexOf('nav') >= 0) {
                return true;
            }
            cur = cur.parentElement;
        }
        return false;
    }

    /* ============================================================
     * 1. CSS 强制隐藏广告
     * ============================================================ */
    function buildAdCSS() {
        var selectors = [];
        var attrs = ['id', 'class', 'name', 'data-ad', 'data-ad-client', 'data-ad-slot', 'data-ad-layout', 'aria-label'];
        for (var i = 0; i < CONFIG.adKeywords.length; i++) {
            var kw = CONFIG.adKeywords[i];
            for (var j = 0; j < attrs.length; j++) {
                selectors.push('[' + attrs[j] + '*="' + kw + '"]');
            }
        }
        selectors.push('ins[class*="adsbygoogle"]');
        selectors.push('ins.adsbygoogle');
        selectors.push('iframe[id*="google_ads"]');
        selectors.push('iframe[src*="doubleclick"]');
        selectors.push('iframe[src*="googlesyndication"]');
        selectors.push('iframe[src*="googleads"]');
        selectors.push('iframe[src*="adform"]');
        selectors.push('iframe[src*="criteo"]');
        selectors.push('iframe[src*="taboola"]');
        selectors.push('iframe[src*="outbrain"]');

        // 站点专属选择器
        var siteSels = getSiteSelectors();
        for (var s = 0; s < siteSels.length; s++) {
            selectors.push(siteSels[s]);
        }

        var css = selectors.join(',') + '{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;z-index:-9999!important;width:0!important;height:0!important;overflow:hidden!important;}';
        return css;
    }

    function injectCSS(css) {
        try {
            if (typeof GM_addStyle === 'function') {
                GM_addStyle(css);
                return;
            }
        } catch (e) {}
        function doInject() {
            var parent = document.head || document.documentElement;
            if (!parent) { setTimeout(doInject, 10); return; }
            var style = document.createElement('style');
            style.textContent = css;
            style.setAttribute('data-script', 'adblock');
            parent.appendChild(style);
        }
        doInject();
    }

    /* ============================================================
     * 2. DOM 扫描与广告移除
     * ============================================================ */
    // 主内容判定：命中主内容的元素绝不可移除（防整页黑屏的最后防线）
    function isMainContent(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el === document.body || el === document.documentElement) return true;
        try {
            // body 下唯一的顶层元素（脚本/样式除外）是页面骨架，绝不移除
            if (el.parentNode === document.body) {
                var tops = 0;
                for (var i = 0; i < document.body.children.length; i++) {
                    var tn = document.body.children[i].tagName;
                    if (tn !== 'SCRIPT' && tn !== 'STYLE' && tn !== 'LINK') tops++;
                }
                if (tops <= 1) return true;
            }
            var rect = el.getBoundingClientRect();
            var vw = window.innerWidth || 1;
            var vh = window.innerHeight || 1;
            var area = (rect.width * rect.height) / (vw * vh);
            if (area < 0.6) return false; // 小块内容不可能是页面骨架
            var style = getComputedStyle(el);
            var pos = style.position;
            var z = parseInt(style.zIndex) || 0;
            // 高层级浮动层（遮罩/弹窗）允许移除
            if ((pos === 'fixed' || pos === 'absolute') && z >= 100) return false;
            // 大面积且内容丰富 → 主内容
            if ((el.textContent || '').trim().length > 500) return true;
            if (el.getElementsByTagName('a').length > 15) return true;
            // 静态定位的满屏容器 → 页面骨架
            if (area > 0.95 && pos !== 'fixed' && pos !== 'absolute') return true;
        } catch (e) {}
        return false;
    }

    function removeAdElement(el) {
        if (!el || !el.parentNode) return;
        // 终极防黑屏保护：页面骨架/主内容绝不可移除
        if (isMainContent(el)) return;
        // 保护：包含功能性元素的容器绝不可移除（搜索框、菜单、导航、表单等）
        if (containsFunctionalElement(el)) return;
        try {
            el.parentNode.removeChild(el);
        } catch (e) {
            try {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
            } catch (e2) {}
        }
    }

    // 判断元素面积占视口比例（用于保护大容器不被误删）
    function getAreaRatio(el) {
        try {
            var rect = el.getBoundingClientRect();
            var vw = window.innerWidth || 1;
            var vh = window.innerHeight || 1;
            return (rect.width * rect.height) / (vw * vh);
        } catch (e) { return 0; }
    }

    // 根据广告/登录特征，向上查找要移除的容器
    // 关键改进：限制上溯层数，遇到功能性容器或主内容时停止，防止整页误删
    function getAdContainer(el) {
        if (!el) return null;

        // 广告角标：从角标向上找广告卡片容器
        if (hasAdTextLabel(el)) {
            var card = el;
            for (var i = 0; i < CONFIG.maxContainerClimb && card && card.parentNode; i++) {
                card = card.parentNode;
                if (!card || card === document.body || card === document.documentElement) break;
                // 遇到主内容或功能性容器，停止上溯（只移除角标本身）
                if (isMainContent(card)) break;
                if (containsFunctionalElement(card)) break;
                var cls = (typeof card.className === 'string') ? card.className.toLowerCase() : '';
                var role = card.getAttribute && card.getAttribute('role') || '';
                var dataE2e = card.getAttribute && card.getAttribute('data-e2e') || '';
                if (cls.indexOf('card') >= 0 || cls.indexOf('item') >= 0 ||
                    cls.indexOf('feed') >= 0 || cls.indexOf('container') >= 0 ||
                    cls.indexOf('wrap') >= 0 || cls.indexOf('box') >= 0 ||
                    cls.indexOf('block') >= 0 || cls.indexOf('cell') >= 0 ||
                    role === 'article' || dataE2e.indexOf('feed') >= 0 ||
                    card.children.length >= 3) {
                    // 确认该卡片容器不包含功能性元素才返回
                    if (!containsFunctionalElement(card)) return card;
                }
            }
            return el; // 找不到卡片容器时只移除角标本身
        }

        // 登录弹窗：找弹窗/遮罩容器（播放器内的登录提示只移除自身）
        // 注意：不在这里匹配 'card'——CSDN 等站点的正文容器可能含 card 类名，上溯删除会误删整页
        if (hasLoginPromptText(el)) {
            if (isInVideoPlayer(el)) return el;
            var lc = el;
            for (var j = 0; j < CONFIG.maxContainerClimb && lc && lc.parentNode; j++) {
                lc = lc.parentNode;
                if (!lc || lc === document.body || lc === document.documentElement) break;
                if (isMainContent(lc)) break;
                if (containsFunctionalElement(lc)) break;
                // 面积保护：占视口超 30% 的大容器绝不删除（防止误删正文/布局容器）
                if (getAreaRatio(lc) > 0.3) break;
                var lcls = (typeof lc.className === 'string') ? lc.className.toLowerCase() : '';
                var lrole = lc.getAttribute && lc.getAttribute('role') || '';
                if (lcls.indexOf('modal') >= 0 || lcls.indexOf('dialog') >= 0 ||
                    lcls.indexOf('popup') >= 0 || lcls.indexOf('mask') >= 0 ||
                    lcls.indexOf('panel') >= 0 ||
                    lrole === 'dialog' || lrole === 'modal' ||
                    lcls.indexOf('login') >= 0) {
                    if (!containsFunctionalElement(lc)) return lc;
                }
            }
            return el;
        }

        // 广告链接：找包含该链接的卡片容器
        if (hasAdLink(el)) {
            var ac = el;
            for (var k = 0; k < CONFIG.maxContainerClimb && ac && ac.parentNode; k++) {
                ac = ac.parentNode;
                if (!ac || ac === document.body || ac === document.documentElement) break;
                if (isMainContent(ac)) break;
                if (containsFunctionalElement(ac)) break;
                var acls = (typeof ac.className === 'string') ? ac.className.toLowerCase() : '';
                if (acls.indexOf('card') >= 0 || acls.indexOf('item') >= 0 ||
                    acls.indexOf('feed') >= 0 || acls.indexOf('container') >= 0 ||
                    acls.indexOf('wrap') >= 0 || acls.indexOf('box') >= 0 ||
                    acls.indexOf('block') >= 0 || acls.indexOf('cell') >= 0 ||
                    ac.children.length >= 3) {
                    if (!containsFunctionalElement(ac)) return ac;
                }
            }
            return el;
        }
        return el;
    }

    function scanAndRemove(root) {
        if (!root) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        var node = walker.nextNode();
        var count = 0;
        while (node && count < 2000) {
            if (isAdElement(node)) {
                var target = getAdContainer(node);
                // 最终保护：如果目标包含功能性元素或视频播放器，绝不移除
                if (containsFunctionalElement(target) || containsVideoPlayer(target)) {
                    node = walker.nextNode();
                } else {
                    var parent = target.parentNode;
                    removeAdElement(target);
                    node = parent;
                }
            } else {
                node = walker.nextNode();
            }
            count++;
        }
    }

    /* ============================================================
     * 3. 全屏遮罩层检测与移除
     * ============================================================ */
    function isFullScreenOverlay(el) {
        if (!el || el.nodeType !== 1) return false;
        if (el === document.body || el === document.documentElement) return false;
        // 保护：功能性元素或包含功能性元素的容器不视为遮罩
        if (isFunctionalElement(el) || containsFunctionalElement(el)) return false;
        try {
            var style0 = getComputedStyle(el);
            var pos = style0.position;
            // 遮罩必定是全屏浮动定位；静态/相对定位的大元素是正常页面内容，绝不视为遮罩
            if (pos !== 'fixed' && pos !== 'absolute') return false;
            var rect = el.getBoundingClientRect();
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            if (vw === 0 || vh === 0) return false;
            var areaRatio = (rect.width * rect.height) / (vw * vh);
            if (areaRatio < CONFIG.overlayThreshold) return false;
            var zIndex = parseInt(getComputedStyle(el).zIndex) || 0;
            var pointerEvents = getComputedStyle(el).pointerEvents;
            var opacity = parseFloat(getComputedStyle(el).opacity) || 1;
            if (zIndex >= 1000 && pointerEvents !== 'none') {
                return true;
            }
            if (opacity < 0.1 && pointerEvents !== 'none' && areaRatio > 0.95) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function detectAndRemoveOverlays() {
        var all = document.querySelectorAll('div, section, aside, span, iframe');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            // 保护：包含功能性元素或视频播放器的元素绝不作为遮罩移除
            if (containsFunctionalElement(el) || containsVideoPlayer(el)) continue;
            if (isFullScreenOverlay(el)) {
                // 只移除确证的遮罩：广告元素 / 登录诱导 / 完全无内容的空遮罩
                if (isAdElement(el) || hasLoginPromptText(el) || !el.textContent.trim()) {
                    removeAdElement(el);
                }
            }
        }
    }

    /* ============================================================
     * 4. 跳转拦截
     * ============================================================ */
    function installRedirectBlocker() {
        if (!CONFIG.blockRedirects) return;
        var _open = window.open;
        window.open = function (url, name, features) {
            if (url && isAdUrl(url)) {
                console.log('[AdBlock] 拦截广告弹窗:', url);
                return null;
            }
            return _open.apply(this, arguments);
        };
        var _assign = location.assign.bind(location);
        var _replace = location.replace.bind(location);
        try {
            Object.defineProperty(location, 'assign', {
                value: function (url) {
                    if (url && isAdUrl(url)) {
                        console.log('[AdBlock] 拦截广告跳转:', url);
                        return;
                    }
                    return _assign(url);
                },
                configurable: true,
                writable: true
            });
            Object.defineProperty(location, 'replace', {
                value: function (url) {
                    if (url && isAdUrl(url)) {
                        console.log('[AdBlock] 拦截广告替换:', url);
                        return;
                    }
                    return _replace(url);
                },
                configurable: true,
                writable: true
            });
        } catch (e) {}
    }

    /* ============================================================
     * 5. 网络请求拦截
     * ============================================================ */
    function installNetworkBlocker() {
        if (!CONFIG.blockNetwork) return;
        if (window.fetch) {
            var _fetch = window.fetch;
            window.fetch = function (input, init) {
                var url = (typeof input === 'string') ? input : (input && input.url);
                if (url && isAdUrl(url)) {
                    console.log('[AdBlock] 拦截广告请求(fetch):', url);
                    return Promise.resolve(new Response('', { status: 204, statusText: 'No Content' }));
                }
                return _fetch.apply(this, arguments);
            };
        }
        var _openXHR = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            var args = Array.prototype.slice.call(arguments);
            if (url && isAdUrl(String(url))) {
                console.log('[AdBlock] 拦截广告请求(xhr):', url);
                args[1] = 'data:text/plain;charset=utf-8,';
            }
            return _openXHR.apply(this, args);
        };
    }

    /* ============================================================
     * 6. MutationObserver 监听动态广告
     * ============================================================ */
    function installObserver() {
        if (!('MutationObserver' in window)) return;
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        var node = mutation.addedNodes[j];
                        if (node.nodeType === 1) {
                            if (isAdElement(node)) {
                                var t = getAdContainer(node);
                                if (!containsFunctionalElement(t) && !containsVideoPlayer(t)) {
                                    removeAdElement(t);
                                }
                            } else {
                                scanAndRemove(node);
                            }
                        }
                    }
                }
                if (mutation.type === 'attributes') {
                    if (isAdElement(mutation.target)) {
                        var t2 = getAdContainer(mutation.target);
                        if (!containsFunctionalElement(t2) && !containsVideoPlayer(t2)) {
                            removeAdElement(t2);
                        }
                    }
                }
            }
        });
        observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id', 'class', 'style', 'data-ad', 'role']
        });
        return observer;
    }

    /* ============================================================
     * 7. 点击事件拦截
     * ============================================================ */
    function installClickInterceptor() {
        document.addEventListener('click', function (e) {
            var target = e.target;
            if (!target) return;
            var el = target;
            while (el && el !== document.body) {
                if (isFullScreenOverlay(el) && (isAdElement(el) || !el.textContent.trim())) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    removeAdElement(el);
                    console.log('[AdBlock] 拦截广告遮罩点击');
                    return false;
                }
                el = el.parentElement;
            }
        }, true);
    }

    /* ============================================================
     * 主流程
     * ============================================================ */
    function init() {
        if (inWhitelist()) {
            console.log('[AdBlock] 网站在白名单中，已跳过');
            return;
        }
        console.log('[AdBlock] 广告屏蔽已启动 v' + VERSION);

        injectCSS(buildAdCSS());
        installRedirectBlocker();
        installNetworkBlocker();

        if (document.body) {
            scanAndRemove(document.body);
            detectAndRemoveOverlays();
        }

        installObserver();
        installClickInterceptor();

        var scanCount = 0;
        var interval = setInterval(function () {
            scanCount++;
            if (document.body) {
                scanAndRemove(document.body);
                detectAndRemoveOverlays();
            }
            if (scanCount >= 60) {
                clearInterval(interval);
            }
        }, 500);
    }

    if (!inWhitelist()) {
        installRedirectBlocker();
        installNetworkBlocker();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
