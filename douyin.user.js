// ==UserScript==
// @name         抖音面板-多重优化版（降噪+万位）
// @namespace    http://181711.xyz/
// @version      1.0.1
// @description  减少调试刷屏、防高频扫描卡死，更新面板字段，F刷新按钮，多重防变更
// @author       You
// @match        https://www.douyin.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=douyin.com
// @grant        none
// ==/UserScript==

(function () {
    let panelEl = null;
    let panelCollapsed = false;
    let observerDebounceTimer = null;
    const backupClassPool = ["EB3BkdQ8", "frUrWD64"];
    const hasHashTagReg = /#\S+/;

    function formatWanSep(val) {
        if (val === null || val === undefined || val === "") return "无";
        let numStr = String(val);
        if (!/^\d+$/.test(numStr)) return val;
        let res = "";
        let cnt = 0;
        for (let i = numStr.length - 1; i >= 0; i--) {
            res = numStr[i] + res;
            cnt++;
            if (cnt === 4 && i !== 0) {
                res = "," + res;
                cnt = 0;
            }
        }
        return res;
    }

    const fieldList = [
        { key: "nickname", label: "作者", linkSearch: true },
        { key: "unique_id", label: "抖音号" },
        { key: "short_id", label: "抖音号" },
        { key: "sub_title", label: "群聊数" },
        { key: "ip_location", label: "IP属地" },
        { key: "user_age", label: "年龄" },
        { key: "country", label: "国家" },
        { key: "signature", label: "简介" },
        { key: "province", label: "省份" },
        { key: "city", label: "城市" },
        { key: "aweme_count", label: "作品数量", wanFormat: true },
        { key: "max_follower_count", label: "粉丝峰值", wanFormat: true },
        { key: "total_favorited", label: "总获赞量", wanFormat: true },
        { key: "following_count", label: "关注总数", wanFormat: true },
    ];
    let dragState = { isDrag: false, offsetX: 0, offsetY: 0 };
    let eventBindFlag = false;

    function createPanel() {
        if (panelEl && document.body.contains(panelEl)) return panelEl;
        panelEl = document.createElement("div");
        panelEl.style.cssText = `
            position:fixed;left:95px;top:273px;width:290px;
            background:rgba(0,0,0,0.78);color:#fff;border-radius:8px;padding:10px;
            z-index:99999999;font-size:13px;backdrop-filter:blur(8px);user-select:text;
        `;
        const dragHeader = document.createElement("div");
        dragHeader.innerText = "【拖动窗口】键盘F加载主页数据";
        dragHeader.style.cssText = "cursor:move;padding:4px 0;border-bottom:1px solid #555;margin-bottom:6px;color:#ddd;";

        const refreshFBtn = document.createElement("button");
        refreshFBtn.innerText = "F键";
        refreshFBtn.style.cssText = "float:right;padding:2px 6px;font-size:12px;cursor:pointer;margin-left:8px";
        refreshFBtn.onclick = () => {
            const keydownEvt = new KeyboardEvent("keydown", {key:"F",code:"KeyF"});
            document.dispatchEvent(keydownEvt);
        };

        const toggleBtn = document.createElement("button");
        toggleBtn.innerText = "收起";
        toggleBtn.style.cssText = "float:right;padding:2px 6px;font-size:12px;cursor:pointer;margin-left:8px";
        toggleBtn.onclick = () => {
            panelCollapsed = !panelCollapsed;
            const wrap = panelEl.querySelector("#dy_content");
            if (wrap) wrap.style.display = panelCollapsed ? "none" : "block";
            toggleBtn.innerText = panelCollapsed ? "展开" : "收起";
        };

        const contentWrap = document.createElement("div");
        contentWrap.id = "dy_content";
        contentWrap.innerHTML = "<div style='color:#aaa'>等待捕获profile接口...</div>";

        panelEl.appendChild(refreshFBtn);
        panelEl.appendChild(toggleBtn);
        panelEl.appendChild(dragHeader);
        panelEl.appendChild(contentWrap);
        document.body.appendChild(panelEl);

        dragHeader.onmousedown = (e) => {
            dragState.isDrag = true;
            dragState.offsetX = e.clientX - panelEl.getBoundingClientRect().left;
            dragState.offsetY = e.clientY - panelEl.getBoundingClientRect().top;
            e.preventDefault();
        };
        document.addEventListener("mousemove", (e) => {
            if (!dragState.isDrag) return;
            let newL = e.clientX - dragState.offsetX;
            let newT = e.clientY - dragState.offsetY;
            const w = panelEl.offsetWidth, h = panelEl.offsetHeight;
            const winW = window.innerWidth, winH = window.innerHeight;
            newL = Math.max(0, Math.min(newL, winW - w));
            newT = Math.max(0, Math.min(newT, winH - h));
            panelEl.style.left = newL + "px";
            panelEl.style.top = newT + "px";
        });
        document.addEventListener("mouseup", () => dragState.isDrag = false);
        return panelEl;
    }
    function showData(rawJson) {
        try {
            createPanel();
            const contentWrap = panelEl.querySelector("#dy_content");
            const user = rawJson?.user || {};
            if (!user || Object.keys(user).length === 0) {
                contentWrap.innerHTML = `<div style="color:red">捕获成功，但user为空</div>`;
                return;
            }
            const subTitles = [];
            if (Array.isArray(user.card_entries)) {
                user.card_entries.forEach(item => {
                    if (item?.sub_title) subTitles.push(item.sub_title);
                });
            }
            if (user.sub_title) subTitles.push(user.sub_title);
            const subTitleStr = subTitles.length > 0 ? subTitles.join(" | ") : "无";
            let html = "";
            fieldList.forEach(f => {
                let val = f.key === "sub_title" ? subTitleStr : user[f.key];
                if (val === undefined || val === null || val === "") val = "无";
                if (f.wanFormat) val = formatWanSep(val);
                if (f.key === "signature" && val !== "无") val = val.replace(/\n/g, "<br>");
                if (f.linkSearch && val !== "无") {
                    const searchUrl = "https://haokan.baidu.com/web/search/page?query=" + encodeURIComponent(val);
                    html += `<div style="margin:4px 0;"><b>${f.label}：</b><a target="_blank" href="${searchUrl}" style="color:#5cf;text-decoration:underline;">${val}</a></div>`;
                } else {
                    html += `<div style="margin:4px 0;"><b>${f.label}：</b>${val}</div>`;
                }
            });
            contentWrap.innerHTML = html;
        } catch (err) {
        }
    }
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
            const u = this._url || '';
            if (u.includes('/aweme/v1/web/user/profile/other/')) {
                try {
                    const jsonData = JSON.parse(this.responseText);
                    showData(jsonData);
                } catch (e) {}
            }
        });
        return origSend.apply(this, arguments);
    };
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        const resp = await originalFetch.apply(this, args);
        if (url.includes('/aweme/v1/web/user/profile/other/')) {
            const clone = resp.clone();
            const text = await clone.text();
            try {
                const jsonData = JSON.parse(text);
                showData(jsonData);
            } catch (e) {}
        }
        return resp;
    };

    function findVideoTextP(clickTarget) {
        const videoCardA = clickTarget.closest('a[href^="/video/"]');
        if (!videoCardA) return null;
        let pList = Array.from(videoCardA.children).filter(el => el.tagName === "P");
        let targetP = null;
        if (pList.length > 0) {
            const hasTagP = pList.find(p => hasHashTagReg.test(p.innerText));
            if (hasTagP) targetP = hasTagP;
            else targetP = pList[0];
        } else {
            for (const cls of backupClassPool) {
                const found = videoCardA.querySelector(`p.${cls}`);
                if (found) {
                    targetP = found;
                    break;
                }
            }
        }
        return targetP;
    }

    function globalClickHandler(e) {
        const videoInfoWrap = e.target.closest("#video-info-wrap");
        if (videoInfoWrap) {
            const hashTagA = e.target.closest("a[href*='/search/']");
            if (hashTagA && hashTagA.innerText.startsWith("#")) {
                const tagText = hashTagA.innerText.trim();
                const searchLink = "https://haokan.baidu.com/web/search/page?query=" + encodeURIComponent(tagText);
                if (e.ctrlKey || e.button === 2) {
                    window.open(searchLink, "_blank");
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            const titleDom = e.target.closest("div.title.cursorPointer");
            if (titleDom) {
                const txt = titleDom.innerText.trim();
                if (txt && (e.ctrlKey || e.button === 2)) {
                    const url = "https://haokan.baidu.com/web/search/page?query=" + encodeURIComponent(txt);
                    window.open(url, "_blank");
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
        }
        const pDom = findVideoTextP(e.target);
        if (!pDom) return;
        const fullText = pDom.innerText.trim();
        if (fullText && (e.ctrlKey || e.button === 2)) {
            const url = "https://haokan.baidu.com/web/search/page?query=" + encodeURIComponent(fullText);
            window.open(url, "_blank");
            e.preventDefault();
            e.stopPropagation();
        }
    }
    function globalHoverHandler(e) {
        let target = e.target;
        const matchPlayPage = target.closest("#video-info-wrap div.title.cursorPointer") || target.closest("#video-info-wrap a[href*='/search/']");
        const pDom = findVideoTextP(target);
        if (matchPlayPage || pDom) {
            target.style.cursor = "pointer";
            target.title = "Ctrl+左键 → 好看搜索，普通左键保留抖音原生跳转";
        }
    }

    function bindSearchLogic() {
        if(eventBindFlag) return;
        document.body.addEventListener("click", globalClickHandler, true);
        document.body.addEventListener("mouseover", globalHoverHandler, true);
        eventBindFlag = true;
    }

    const originalPush = history.pushState;
    history.pushState = function (...args) {
        originalPush.apply(history, args);
        setTimeout(() => bindSearchLogic(), 350);
    };
    window.addEventListener("popstate", () => setTimeout(() => bindSearchLogic(), 350));

    const observer = new MutationObserver(() => {
        clearTimeout(observerDebounceTimer);
        observerDebounceTimer = setTimeout(() => {
            bindSearchLogic();
            const cards = document.querySelectorAll('a[href^="/video/"]');
            if (cards.length === 0 && location.pathname.startsWith('/@')) {
                console.warn("⚠️自检告警：作者主页未扫描到视频卡片，结构可能改版！请更新");
            }
        }, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    bindSearchLogic();
})();
