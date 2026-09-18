// ==UserScript==
// @name         好看视频+百家号三处双向跳转【悬浮虚线版】
// @namespace    http://181711.xyz/
// @version      1.0.1
// @description 平时无虚线，鼠标悬浮才出现虚线；修复搜索下拉加载新增条目失效
// @match        https://haokan.baidu.com/author/*
// @match        https://haokan.baidu.com/web/search/page?query=*
// @match        https://baijiahao.baidu.com/u?app_id=*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';
    const CONFIG = {
        retryInterval: 500,
        maxRetry: 40
    };
    const markAttr = "data-link-redirected";
    let retryCount = 0;
    let lastUrl = location.href;
    let listObserver = null;

    function runHaoKanAuthorPage() {
        const elSpan = document.querySelector("#pageScrollContainer > section > div > div > div.userinfo-left > span");
        if (!elSpan) return false;
        if (elSpan[markAttr]) return true;
        elSpan[markAttr] = true;

        const m = location.pathname.match(/\/author\/([^/?#]+)/);
        if (!m) return false;
        const uid = m[1];
        const targetUrl = `https://baijiahao.baidu.com/u?app_id=${uid}`;

        elSpan.style.cursor = "pointer";
        elSpan.title = "点击跳转百家号主页";
        elSpan.addEventListener('mouseenter', () => elSpan.style.textDecoration = "underline dotted");
        elSpan.addEventListener('mouseleave', () => elSpan.style.textDecoration = "none");

        elSpan.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();
            window.open(targetUrl, "_blank");
        };
        console.log("[好看作者页]已绑定，跳转：", targetUrl);
        return true;
    }

    function bindSearchItems() {
        const itemLinks = document.querySelectorAll("#rooot > section > main > section > main > div > div > div > a.clearfix");
        let hasBind = false;
        itemLinks.forEach(linkA => {
            if (linkA[markAttr]) return;
            linkA[markAttr] = true;
            const rawHref = linkA.getAttribute("href");
            const matchId = rawHref.match(/\/author\/([^/?#]+)/);
            if (!matchId) return;
            hasBind = true;
            const uid = matchId[1];
            const targetUrl = `https://baijiahao.baidu.com/u?app_id=${uid}`;
            const avatarImg = linkA.querySelector("div.list-header-avatar > img[alt='avatar']");
            if (!avatarImg) return;
            avatarImg.style.cursor = "pointer";
            avatarImg.title = "点击头像跳转百家号主页";
            avatarImg.onclick = function (e) {
                e.stopPropagation();
                e.preventDefault();
                window.open(targetUrl, "_blank");
            }
        });
        return hasBind;
    }

    function watchSearchList() {
        if (listObserver) listObserver.disconnect();
        const listContainer = document.querySelector("#rooot > section > main > section > main > div > div");
        if (!listContainer) return;
        listObserver = new MutationObserver(() => {
            bindSearchItems();
        });
        listObserver.observe(listContainer, {childList: true, subtree: true});
        bindSearchItems();
        console.log("[搜索列表]开启动态监听，新增条目自动绑定");
    }

    function runBaiJiaHaoPage() {
        const nameEl = document.querySelector("#app > div > div.page-header > div > div > div > div.pc-user-middle > h2");
        if (!nameEl) return false;
        if (nameEl[markAttr]) return true;
        nameEl[markAttr] = true;
        const urlParams = new URLSearchParams(location.search);
        const aid = urlParams.get("app_id");
        if (!aid) return false;
        const jumpUrl = `https://haokan.baidu.com/author/${aid}`;
        nameEl.style.cursor = "pointer";
        nameEl.title = "点击跳转好看视频作者主页";
        nameEl.addEventListener('mouseenter', () => nameEl.style.textDecoration = "underline dotted");
        nameEl.addEventListener('mouseleave', () => nameEl.style.textDecoration = "none");

        nameEl.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();
            window.open(jumpUrl, "_blank");
        };
        console.log("[百家号页面]已绑定，跳转：", jumpUrl);
        return true;
    }

    function clearObservers() {
        if(listObserver){
            listObserver.disconnect();
            listObserver=null;
        }
    }

    function startTaskLoop() {
        clearObservers();
        retryCount = 0;
        const timer = setInterval(() => {
            retryCount++;
            let done = false;
            const url = location.href;
            if (url.includes("haokan.baidu.com/author/")) {
                done = runHaoKanAuthorPage();
            } else if (url.includes("haokan.baidu.com/web/search/page")) {
                watchSearchList();
                done=true;
            } else if (url.includes("baijiahao.baidu.com/u?")) {
                done = runBaiJiaHaoPage();
            }
            if (done || retryCount >= CONFIG.maxRetry) {
                clearInterval(timer);
                if (!done && retryCount >= CONFIG.maxRetry) {
                    console.warn("[脚本]超时未找到目标DOM元素");
                }
            }
        }, CONFIG.retryInterval);
    }
    startTaskLoop();

    const urlObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            startTaskLoop();
        }
    });
    urlObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
