// client.js

const socket = io(); // 連接到服務器
let userName = ""; // 保存用戶的姓名

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
 * 啟動時詢問用戶姓名
 */
window.onload = function () {
  while (!userName) {
    userName = prompt("請輸入您的姓名:");
  }
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

  if (messageHtml.trim() === "") {
    return; // 如果訊息為空，不執行
  }

  // 發送消息到服務器，附帶用戶姓名和 intervals
  socket.emit("chatMessage", {
    name: userName,
    message: messageHtml,
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
  const spans = Array.from(tempDiv.querySelectorAll("span")); // 獲取所有字符的 span

  // 使用 intervals 來決定每個字元出現的時間點
  let accumulatedTime = 0;
  spans.forEach((span, index) => {
    let interval = intervals[index] || 100; // 若無資料，預設100ms
    accumulatedTime += interval;
    setTimeout(() => {
      container.appendChild(span);
    }, accumulatedTime);
  });
}

// 當收到來自服務器的消息時，將其顯示在聊天窗口，帶有打字動畫
socket.on("chatMessage", (data) => {
  const messageElement = document.createElement("div");
  messageElement.classList.add("sent-message");
  const nameElement = document.createElement("strong");
  nameElement.textContent = `${data.name}: `;
  messageElement.appendChild(nameElement);

  const messageContent = document.createElement("span");
  messageElement.appendChild(messageContent);

  sentMessages.appendChild(messageElement);
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
  if (event.key === "Enter" && !isComposing) {
    event.preventDefault(); // 防止換行
    sendMessage();
  }
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
});
