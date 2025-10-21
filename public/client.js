// client.js

const socket = io(); // 連接到服務器
let userName = ""; // 保存用戶的姓名

// // 30 秒自動重新載入功能（已註解）
// let autoReloadTimer = null;
//
// // 重置自動重新載入計時器
// function resetAutoReloadTimer() {
//   // 清除舊的計時器
//   if (autoReloadTimer) {
//     clearTimeout(autoReloadTimer);
//   }
//   // 設置新的計時器，30 秒後重新載入
//   autoReloadTimer = setTimeout(() => {
//     location.reload();
//   }, 30000); // 30000 毫秒 = 30 秒
// }
//
// // 初始化計時器
// resetAutoReloadTimer();

// 每分鐘檢查一次，如果超過晚上 12 點就重新載入
function checkMidnightReload() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // 如果是凌晨 0 點 0 分（過了晚上 12 點），重新載入頁面
  if (hours === 0 && minutes === 0) {
    location.reload();
  }
}

// 每分鐘檢查一次
setInterval(checkMidnightReload, 60000); // 60000 毫秒 = 1 分鐘

const inputArea = document.getElementById("inputArea");
const displayArea = document.getElementById("displayArea");
const sentMessages = document.getElementById("sentMessages");
const toggleLanguageBtn = document.getElementById("toggleLanguage");
const togglecontrolBtn = document.getElementById("togglecontrol");
const sliderContainer = document.getElementById("slider-container");
let lastCommittedTime = null;
let committedValue = "";
let isComposing = false; // 標記是否在進行輸入法組合
let isJapanese = false; // 日文輸入模式標記
let isSetting = false; // 控制面板顯示/隱藏
let charIntervals = []; // 用於記錄每個字元的輸入間隔

// 取得滑桿元素和顯示值的元素
const minSpacingSlider = document.getElementById("minSpacing");
const maxSpacingSlider = document.getElementById("maxSpacing");
const spacingFactorSlider = document.getElementById("spacingFactor");
const thresholdIntervalSlider = document.getElementById("thresholdInterval");

const minSpacingValue = document.getElementById("minSpacingValue");
const maxSpacingValue = document.getElementById("maxSpacingValue");
const spacingFactorValue = document.getElementById("spacingFactorValue");
const thresholdIntervalValue = document.getElementById(
  "thresholdIntervalValue"
);

// 初始化參數
let minSpacing = parseInt(minSpacingSlider.value); // 最緊密，負值表示重疊
let maxSpacing = parseInt(maxSpacingSlider.value); // 最寬松
let spacingFactor = parseFloat(spacingFactorSlider.value); // 字間距比例因子
let thresholdInterval = parseInt(thresholdIntervalSlider.value); // 閾值間隔（毫秒）
// 新增一個 caret 元素
const caret = document.createElement("span");
caret.id = "caret"; // 在 input事件或發送後都要確保 caret 在最後
function updateCaretPosition() {
  // 確保 caret 在最後一個字元之後
  // 如果 displayArea 有字元，則將 caret 移到最後
  // 如果 displayArea 是空的，caret 就在 displayArea 開頭
  if (displayArea.lastChild && displayArea.lastChild.id !== "caret") {
    displayArea.appendChild(caret);
  } else if (!displayArea.lastChild) {
    displayArea.appendChild(caret);
  }
}
/**
 * 更新滑桿顯示值
 */
function updateSliderValues() {
  minSpacing = parseInt(minSpacingSlider.value);
  maxSpacing = parseInt(maxSpacingSlider.value);
  spacingFactor = parseFloat(spacingFactorSlider.value);
  thresholdInterval = parseInt(thresholdIntervalSlider.value);

  minSpacingValue.textContent = minSpacing;
  maxSpacingValue.textContent = maxSpacing;
  spacingFactorValue.textContent = spacingFactor.toFixed(2);
  thresholdIntervalValue.textContent = thresholdInterval;
}

// 初始顯示滑桿值
updateSliderValues();

// 當滑桿值改變時，更新相關變數和顯示值
minSpacingSlider.addEventListener("input", updateSliderValues);
maxSpacingSlider.addEventListener("input", updateSliderValues);
spacingFactorSlider.addEventListener("input", updateSliderValues);
thresholdIntervalSlider.addEventListener("input", updateSliderValues);

/**
 * 切換控制面板顯示/隱藏
 */
togglecontrolBtn.addEventListener("click", () => {
  isSetting = !isSetting;
  if (isSetting) {
    togglecontrolBtn.textContent = "close";
    sliderContainer.style.display = "flex";
  } else {
    togglecontrolBtn.textContent = "setting";
    sliderContainer.style.display = "none";
  }
});

/**
 * 為系統消息生成帶有樣式的 HTML
 * @param {string} text - 純文字內容
 * @returns {Object} - { html: HTML 字符串, intervals: 間隔陣列 }
 */
function generateStyledMessageHTML(text) {
  let html = '';
  let intervals = [];

  // 為每個字符生成隨機的間隔（100-200ms），創造自然的打字效果
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const interval = 100 + Math.random() * 100; // 100-200ms
    intervals.push(interval);

    // 計算樣式（使用與 input 事件相同的邏輯）
    const thresholdInterval = 130;
    const spacingFactor = 0.10;
    let calculatedSpacing = (interval - thresholdInterval) * spacingFactor;

    // 計算 scaleX
    let cs = Math.max(-5, Math.min(100, calculatedSpacing));
    let t = (cs + 10) / 110;
    let scaleX = 0.05 + (5 - 0.05) * t;

    // 計算 margin-left
    let marginLeft = -18 + scaleX * 15;

    // 計算顏色
    let cs2 = Math.max(-10, Math.min(100, calculatedSpacing));
    let t2 = (cs2 + 90) / 200;
    let R = Math.round(255 * (1 - t2) + 100);
    let G = Math.round(255 * (1 - t2) + 100);
    let B = 255;
    let color = `rgb(${R},${G},${B})`;

    // 生成 span 元素
    html += `<span class="char" style="display: inline-block; transform-origin: left center; transform: scaleX(${scaleX}); margin-right: ${marginLeft}px; color: ${color};">${char}</span>`;
  }

  return { html, intervals };
}

/**
 * 顯示系統消息
 * @param {string} message - 系統消息內容
 */
function displaySystemMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("sent-message");
  const messageContent = document.createElement("span");
  messageElement.appendChild(messageContent);
  const nameElement = document.createElement("strong");
  nameElement.textContent = "SYSTEM ";
  messageElement.appendChild(nameElement);
  sentMessages.appendChild(messageElement);
  sentMessages.scrollTop = sentMessages.scrollHeight;

  // 生成帶有樣式的 HTML 和 intervals
  const { html, intervals } = generateStyledMessageHTML(message);

  // 使用打字動畫顯示內容
  displayMessageWithAnimation(messageContent, html, intervals);
}

/**
 * 啟動時顯示系統消息詢問用戶姓名
 */
window.onload = function () {
  // 顯示系統消息詢問名字
  displaySystemMessage("あなたの名前は何ですか？ / What's your name?");
  // 自動聚焦到輸入框
  inputArea.focus();
};

/**
 * 比較兩個字符串，找出新增的字符及其起始位置
 * @param {string} oldStr - 之前的字符串
 * @param {string} newStr - 當前的字符串
 * @returns {Object} - { added: 新增的字符, start: 起始位置 }
 */
function getAddedChars(oldStr, newStr) {
  let added = "";
  let start = 0;
  while (
    start < oldStr.length &&
    start < newStr.length &&
    oldStr[start] === newStr[start]
  ) {
    start++;
  }
  added = newStr.slice(start);
  return { added, start };
}

/**
 * 同步顯示區域與輸入區域
 * 如果顯示區域有多餘的字符，將其移除
 * @param {string} inputValue - 輸入區域的當前值
 */
function syncDisplayArea(inputValue) {
  const displayChildren = displayArea.childNodes;
  const inputLength = inputValue.length;

  // 如果顯示區域有多餘的字符，將其移除
  while (displayChildren.length > inputLength) {
    displayArea.removeChild(displayArea.lastChild);
  }
}

/**
 * 禁用刪除鍵並手動處理刪除
 */
function disableDeleteKeys(event) {
  const forbiddenKeys = ["Backspace", "Delete"];
  if (forbiddenKeys.includes(event.key)) {
    event.preventDefault(); // 禁止默認刪除行為

    // 如果是 Backspace 且有字元可刪
    if (event.key === "Backspace" && committedValue.length > 0) {
      const updatedValue = committedValue.slice(0, -1); // 去掉最後一個字符
      inputArea.value = updatedValue; // 更新輸入框內容

      // 移除最後一個 intervals 資料
      charIntervals.pop();

      syncDisplayAreaAfterDelete(updatedValue); // 同步 displayArea
      committedValue = updatedValue; // 更新已提交的值
    }
  }
}
inputArea.addEventListener("keydown", disableDeleteKeys);

/**
 * 同步顯示區域內容並保留樣式（刪除後）
 * @param {string} inputValue - 更新後的輸入值
 */
function syncDisplayAreaAfterDelete(inputValue) {
  const displayChildren = displayArea.childNodes;

  // 如果 displayArea 中字符數量多於 inputValue，刪除多餘的字符
  while (displayChildren.length > inputValue.length) {
    displayArea.removeChild(displayArea.lastChild);
  }

  // 保留現有字符的樣式與字元，只更新文字內容
  for (let i = 0; i < inputValue.length; i++) {
    const span = displayChildren[i];
    if (span) {
      span.textContent = inputValue[i]; // 更新文字
    }
  }
}

/**
 * 發送消息，發送 displayArea 的 HTML 內容和用戶姓名及 intervals
 */
function sendMessage() {
  const messageHtml = displayArea.innerHTML; // 取得 displayArea 的 HTML 內容
  const messageText = committedValue; // 純文字內容，給 AI 分析

  if (messageHtml.trim() === "") {
    return; // 如果訊息為空，不執行
  }

  // 如果用戶還沒有輸入名字，將第一次輸入作為名字
  if (!userName) {
    userName = messageText.trim();
    // 顯示歡迎消息
    displaySystemMessage(`こんにちは、${userName}さん！ / Hello, ${userName}!`);

    // 清空輸入區域和顯示區域
    inputArea.value = "";
    displayArea.innerHTML = "";

    // 重置相關變數
    committedValue = "";
    lastCommittedTime = null;
    charIntervals = []; // 清空 intervals

    return; // 名字設置完成後返回
  }

  // 發送消息到服務器，附帶用戶姓名和 intervals
  socket.emit("chatMessage", {
    name: userName,
    message: messageHtml,
    text: messageText,
    intervals: charIntervals,
  });

  // 清空輸入區域和顯示區域
  inputArea.value = "";
  displayArea.innerHTML = "";

  // 重置相關變數
  committedValue = "";
  lastCommittedTime = null;
  charIntervals = []; // 清空 intervals
}

/**
 * 動態顯示字符動畫，使用原本記錄的 intervals
 * @param {HTMLElement} container - 容器
 * @param {string} messageHtml - 訊息的 HTML
 * @param {number[]} intervals - 每個字元對應的 interval 陣列
 */
function displayMessageWithAnimation(container, messageHtml, intervals) {
  container.innerHTML = ""; // 清空容器
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = messageHtml; // 將 HTML 插入到暫存元素中

  // 依序取出節點，支援 <span> 與 <br>
  const nodes = Array.from(tempDiv.childNodes).filter(
    (n) => n.nodeType === 1 && (n.tagName === "SPAN" || n.tagName === "BR")
  );

  let accumulatedTime = 0;
  let iInterval = 0;
  nodes.forEach((node) => {
    if (node.tagName === "SPAN") {
      const interval = intervals[iInterval] || 100; // 若無資料，預設100ms
      iInterval += 1;
      accumulatedTime += interval;
      setTimeout(() => {
        container.appendChild(node);
      }, accumulatedTime);
    } else if (node.tagName === "BR") {
      // 換行不消耗 interval，於當前時間點插入
      setTimeout(() => {
        container.appendChild(node);
      }, accumulatedTime);
    }
  });
}

// 當收到來自服務器的消息時，將其顯示在聊天窗口，帶有打字動畫
socket.on("chatMessage", (data) => {
  const messageElement = document.createElement("div");
  messageElement.classList.add("sent-message");
  const messageContent = document.createElement("span");
  messageElement.appendChild(messageContent);
  sentMessages.appendChild(messageElement);
  const nameElement = document.createElement("strong");
  nameElement.textContent = `${data.name} `;
  messageElement.appendChild(nameElement);
  sentMessages.scrollTop = sentMessages.scrollHeight; // 滾動到最底部

  // 使用打字動畫顯示內容，依據收到的 intervals 來模擬原本的打字節奏
  displayMessageWithAnimation(
    messageContent,
    data.message,
    data.intervals || []
  );
});

// 處理鍵盤事件以檢測 Enter 鍵
inputArea.addEventListener("keydown", (event) => {
  // // 用戶按鍵，重置自動重新載入計時器（30秒功能已註解）
  // resetAutoReloadTimer();

  if (event.key === "Enter" && !isComposing) {
    event.preventDefault(); // 防止預設換行行為
    sendMessage(); // 執行送出訊息
    document.body.classList.remove("fullscreen-mode");
    window.scrollTo(0, 0);
    if (window.innerWidth < 700) {
      inputArea.blur();
    }
    // 您可在這裡加入移除 fullscreen-mode 的 class 並滾動至最上方等操作
  }
});

inputArea.addEventListener("click", () => {
  // // 用戶點擊輸入框，重置自動重新載入計時器（30秒功能已註解）
  // resetAutoReloadTimer();

  updateCaretPosition();
  inputArea.placeholder = "";
});

// 處理輸入法組合事件
inputArea.addEventListener("compositionstart", () => {
  isComposing = true;
});

inputArea.addEventListener("compositionend", () => {
  isComposing = false;
});

// 處理輸入框事件，動態顯示輸入內容
inputArea.addEventListener("input", (e) => {
  // // 用戶有輸入操作，重置自動重新載入計時器（30秒功能已註解）
  // resetAutoReloadTimer();

  let currentValue = inputArea.value;

  // 如果處於日文模式，將輸入的英文轉換為平假名
  if (isJapanese && window.wanakana) {
    currentValue = wanakana.toHiragana(currentValue);
    inputArea.value = currentValue;
  }

  const { added, start } = getAddedChars(committedValue, currentValue);
  const displayChildren = displayArea.childNodes;

  // 計算字元顏色的函數
  function getColorFromSpacing(calculatedSpacing) {
    let cs = Math.max(-10, Math.min(100, calculatedSpacing));
    // t=0代表cs=-100(快,白); t=1代表cs=100(慢,藍)
    let t = (cs + 90) / 200;

    let R = Math.round(255 * (1 - t) + 100);
    let G = Math.round(255 * (1 - t) + 100);
    let B = 255;
    return `rgb(${R},${G},${B})`;
  }

  function getScaleXFromSpacing(calculatedSpacing) {
    let cs = Math.max(-5, Math.min(100, calculatedSpacing));
    let t = (cs + 10) / 110;
    // t=0(極快)→scaleX=0.05, t=1(極慢)→scaleX=5
    let scaleX = 0.05 + (5 - 0.05) * t;
    return scaleX;
  }

  // 在 input事件中處理新字元邏輯 (僅示意修改後內容)
  // 在 input事件中:
  if (added.length > 0) {
    for (let i = 0; i < added.length; i++) {
      const newChar = added[i];
      const span = document.createElement("span");
      span.textContent = newChar;
      span.classList.add("char");

      const currentTime = new Date().getTime();
      let interval =
        lastCommittedTime !== null ? currentTime - lastCommittedTime : 100;
      lastCommittedTime = currentTime;
      charIntervals.push(interval);

      let calculatedSpacing = (interval - thresholdInterval) * spacingFactor;

      // 計算 scaleX (更極端)
      let scaleX = getScaleXFromSpacing(calculatedSpacing);

      // 計算 margin-left，依 scaleX 放大
      let marginLeft = -18 + scaleX * 15;

      // 計算顏色(白→藍)
      let color = getColorFromSpacing(calculatedSpacing);

      span.style.display = "inline-block";
      span.style.transformOrigin = "left center";
      span.style.transform = `scaleX(${scaleX})`;
      span.style.marginRight = marginLeft + "px";
      span.style.color = color;

      if (start + i < displayChildren.length) {
        displayArea.insertBefore(span, displayChildren[start + i]);
      } else {
        displayArea.appendChild(span);
      }
    }
  } else if (currentValue.length < committedValue.length) {
    // 嘗試刪除字符 - 已透過 disableDeleteKeys 攔截處理
    // 此處保留同步邏輯以防萬一
    displayArea.innerHTML = "";
    for (let i = 0; i < currentValue.length; i++) {
      const span = document.createElement("span");
      span.textContent = currentValue[i];
      span.classList.add("char");
      displayArea.appendChild(span);
    }
  }

  // 同步顯示區域，移除多餘的字符
  syncDisplayArea(currentValue);

  // 更新 committedValue
  committedValue = currentValue;

  updateCaretPosition();
});
const sendButton = document.createElement("button");
sendButton.id = "sendButton";
sendButton.textContent = "send";
document.body.appendChild(sendButton);

inputArea.addEventListener("focus", () => {
  if (window.innerWidth < 700) {
    // 進入行動版特別模式
    inputArea.setAttribute("inputmode", "latin");
    inputArea.placeholder =
      "モバイル版は英語のみ入力可能 The mobile version can only input English";
    document.body.classList.add("fullscreen-mode");
  } else {
    // 桌面版則不作特別限制
    inputArea.removeAttribute("inputmode");
  }
});

sendButton.addEventListener("click", () => {
  sendMessage();
  document.body.classList.remove("fullscreen-mode");
  window.scrollTo(0, 0);
  if (window.innerWidth < 700) {
    inputArea.blur();
  }
});

document.addEventListener("DOMContentLoaded", function () {
  if (window.innerWidth < 700) {
    // 進入行動版特別模式
    inputArea.placeholder =
      "モバイル版は英語のみ入力可能 The mobile version can only input English";
    inputArea.setAttribute("inputmode", "latin"); // 建議顯示英文鍵盤
    inputArea.setAttribute("pattern", "[A-Za-z]*"); // 僅允許英文字符（表單驗證用）
    inputArea.setAttribute("enterkeyhint", "send"); // 鍵盤右下角顯示「送出」
    inputArea.setAttribute("autocorrect", "off"); // 關閉自動更正
    inputArea.setAttribute("autocapitalize", "none"); // 關閉自動大小寫
    inputArea.setAttribute("spellcheck", "false"); // 關閉拼字檢查
  } else {
    // 桌面版則不作特別限制，移除前面設定的屬性
    inputArea.removeAttribute("inputmode");
    inputArea.removeAttribute("pattern");
    inputArea.removeAttribute("enterkeyhint");
    inputArea.removeAttribute("autocorrect");
    inputArea.removeAttribute("autocapitalize");
    inputArea.removeAttribute("spellcheck");
  }
});
