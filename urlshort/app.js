/**
 * URL Shortener - Application Engine & OpenAPI Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Elements
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const shortenBtn = document.getElementById('shortenBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');
  const btnIcon = document.getElementById('btnIcon');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const formFeedback = document.getElementById('formFeedback');

  const resultSection = document.getElementById('resultSection');
  const resultCard = document.getElementById('resultCard');
  const originalUrlText = document.getElementById('originalUrlText');
  const resultUrlInput = document.getElementById('resultUrlInput');
  const copyBtn = document.getElementById('copyBtn');
  const openLinkBtn = document.getElementById('openLinkBtn');
  const makeQrBtn = document.getElementById('makeQrBtn');

  const historyList = document.getElementById('historyList');
  const historyCount = document.getElementById('historyCount');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Background Interactive Glow Elements
  const cursorFollower = document.getElementById('cursorGlowFollower');
  let mouseTargetX = window.innerWidth / 2;
  let mouseTargetY = window.innerHeight / 2;
  let currentMouseX = mouseTargetX;
  let currentMouseY = mouseTargetY;

  // 2. State & History Management
  const STORAGE_KEY = 'url_shortener_history_v1';
  let historyData = loadHistory();

  // 3. Mouse-driven Interactive Dynamic Gradient
  function updateMouseGradient() {
    const lerpFactor = 0.12;
    currentMouseX += (mouseTargetX - currentMouseX) * lerpFactor;
    currentMouseY += (mouseTargetY - currentMouseY) * lerpFactor;

    const width = window.innerWidth || 1200;
    const height = window.innerHeight || 800;

    const normX = Math.max(0, Math.min(1, currentMouseX / width));
    const normY = Math.max(0, Math.min(1, currentMouseY / height));

    const dynamicHue1 = Math.round(22 + normX * 8 + (1 - normY) * 4);
    const dynamicHue2 = Math.round(18 + normY * 8 + normX * 6);
    const dynamicHue3 = Math.round(27 + (1 - normX) * 6 + normY * 4);

    document.documentElement.style.setProperty('--dynamic-hue-1', dynamicHue1);
    document.documentElement.style.setProperty('--dynamic-hue-2', dynamicHue2);
    document.documentElement.style.setProperty('--dynamic-hue-3', dynamicHue3);

    if (cursorFollower) {
      cursorFollower.style.transform = `translate3d(${currentMouseX}px, ${currentMouseY}px, 0) translate(-50%, -50%)`;
    }

    requestAnimationFrame(updateMouseGradient);
  }
  requestAnimationFrame(updateMouseGradient);

  window.addEventListener('mousemove', (e) => {
    mouseTargetX = e.clientX;
    mouseTargetY = e.clientY;
  }, { passive: true });

  // 4. 요구사항 3-2: 입력 필드가 비어 있으면 '단축하기'버튼 비활성화
  function updateButtonState() {
    const value = urlInput.value.trim();
    if (value.length === 0) {
      shortenBtn.disabled = true;
      shortenBtn.setAttribute('disabled', '');
      shortenBtn.title = '단축할 URL을 입력해주세요';
      clearInputBtn.hidden = true;
    } else {
      shortenBtn.disabled = false;
      shortenBtn.removeAttribute('disabled');
      shortenBtn.title = '클릭하여 URL 단축하기';
      clearInputBtn.hidden = false;
    }
  }

  // 초기 상태 설정
  updateButtonState();

  // 입력 감지
  urlInput.addEventListener('input', () => {
    clearFeedback();
    updateButtonState();
  });

  // 지우기 버튼
  clearInputBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearFeedback();
    updateButtonState();
    urlInput.focus();
  });

  // Enter 키 처리 (IME 조합 완료 여부 체크)
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (!shortenBtn.disabled) {
        handleShortenSubmit();
      }
    }
  });

  // 폼 제출
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!shortenBtn.disabled) {
      handleShortenSubmit();
    }
  });

  // 5. 요구사항 3-3: 단축하기 클릭 시 OpenAPI로 URL단축 요청 및 결과 표시
  async function handleShortenSubmit() {
    let rawUrl = urlInput.value.trim();
    if (!rawUrl) return;

    // URL 형식 보정 (프로토콜이 없는 경우 https:// 자동 첨부)
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = 'https://' + rawUrl;
    }

    // URL 유효성 검증
    try {
      const parsedUrl = new URL(rawUrl);
      if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.')) {
        throw new Error('유효한 도메인이 아닙니다.');
      }
    } catch (err) {
      showFeedback('올바른 URL 형식(예: https://example.com)을 입력해 주세요.', 'error');
      urlInput.focus();
      return;
    }

    // 로딩 상태 시작
    setLoadingState(true);
    clearFeedback();

    try {
      const shortUrl = await requestShortenUrlOpenAPI(rawUrl);

      // 결과 렌더링
      displayResult(rawUrl, shortUrl);

      // 히스토리 저장 및 업데이트
      saveToHistory(rawUrl, shortUrl);
      renderHistory();

      showFeedback('URL 단축이 완료되었습니다! (클릭 시 원본으로 직통 연결)', 'success');
      showToast('단축 URL이 성공적으로 생성되었습니다!', 'success');
    } catch (err) {
      console.error('URL Shorten Error:', err);
      showFeedback(err.message || 'URL 단축 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'error');
      showToast('URL 단축에 실패했습니다.', 'error');
    } finally {
      setLoadingState(false);
      updateButtonState();
    }
  }

  // JSONP 요청 헬퍼 함수
  function requestJsonp(url, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_shorten_' + Math.random().toString(36).substring(2, 9);
      const script = document.createElement('script');
      let timer = null;

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      function cleanup() {
        if (timer) clearTimeout(timer);
        try {
          delete window[callbackName];
        } catch (e) {
          window[callbackName] = undefined;
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      timer = setTimeout(() => {
        cleanup();
        reject(new Error('URL 단축 요청 시간이 초과되었습니다.'));
      }, timeoutMs);

      script.onerror = () => {
        cleanup();
        reject(new Error('네트워크 연결 또는 API 응답 오류가 발생했습니다.'));
      };

      const separator = url.includes('?') ? '&' : '?';
      script.src = `${url}${separator}callback=${callbackName}`;
      document.body.appendChild(script);
    });
  }

  // 단축 URL 생성 함수 (1차: Blinkhop(zou.sh) 직통, 2차: Shrtr(shrtr.top) 직통)
  async function requestShortenUrlOpenAPI(targetUrl) {
    // 1차 시도: Blinkhop OpenAPI (공개 인터넷 단축 URL: https://zou.sh/xxxxx - 중간 경유창 없이 0초 직통 리디렉션!)
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 6000);
      const formData = new FormData();
      formData.append('url', targetUrl);

      const res = await fetch('https://api.blinkhop.com/v1/links', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(tid);

      if (res.ok) {
        const json = await res.json();
        if (json.short_url) {
          updateServiceBadge('OpenAPI 직통 단축 (zou.sh)');
          return json.short_url;
        }
      }
    } catch (err) {
      console.warn('1차 Blinkhop OpenAPI 시도 실패:', err);
    }

    // 2차 시도: Shrtr OpenAPI (공개 인터넷 단축 URL: https://shrtr.top/s/xxxxx - 직통 리디렉션)
    try {
      const controller2 = new AbortController();
      const tid2 = setTimeout(() => controller2.abort(), 6000);

      const res2 = await fetch('https://shrtr.top/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
        signal: controller2.signal
      });
      clearTimeout(tid2);

      if (res2.ok) {
        const json2 = await res2.json();
        if (json2.short_url) {
          updateServiceBadge('OpenAPI 직통 단축 (shrtr.top)');
          return json2.short_url;
        }
      }
    } catch (err2) {
      console.warn('2차 Shrtr OpenAPI 시도 실패:', err2);
    }

    // 4차 시도: v.gd OpenAPI via JSONP
    try {
      const vGdUrl = `https://v.gd/create.php?format=json&url=${encodeURIComponent(targetUrl)}`;
      const data2 = await requestJsonp(vGdUrl, 6000);
      if (data2 && data2.shorturl) {
        updateServiceBadge('OpenAPI via v.gd');
        return data2.shorturl;
      }
    } catch (err4) {
      console.warn('4차 v.gd JSONP 시도 실패:', err4);
    }

    throw new Error('URL 단축 서비스(OpenAPI)와의 통신에 일시적으로 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }

  function updateServiceBadge(serviceName) {
    const badge = document.querySelector('.api-service-tag');
    if (badge) {
      badge.textContent = serviceName;
    }
  }

  // 결과 화면 표시
  function displayResult(originalUrl, shortUrl) {
    originalUrlText.textContent = originalUrl;
    originalUrlText.title = originalUrl;
    resultUrlInput.value = shortUrl;
    openLinkBtn.href = shortUrl;

    resultSection.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // 로딩 상태 토글
  function setLoadingState(isLoading) {
    if (isLoading) {
      shortenBtn.disabled = true;
      btnSpinner.hidden = false;
      btnIcon.hidden = true;
      btnText.textContent = '단축 중...';
    } else {
      btnSpinner.hidden = true;
      btnIcon.hidden = false;
      btnText.textContent = '단축하기';
    }
  }

  // 피드백 메시지 표시
  function showFeedback(msg, type = 'error') {
    formFeedback.textContent = msg;
    formFeedback.className = `form-feedback ${type}`;
  }

  function clearFeedback() {
    formFeedback.textContent = '';
    formFeedback.className = 'form-feedback';
  }

  // 6. 요구사항 3-4: '복사'버튼 클릭 시 자동 복사 및 '복사하였습니다' 알림창
  copyBtn.addEventListener('click', async () => {
    const textToCopy = resultUrlInput.value.trim();
    if (!textToCopy) return;

    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      }
    } catch (e) {
      console.warn('Clipboard API 실패, textarea fallback 시도');
    }

    if (!copied) {
      const tempTextarea = document.createElement('textarea');
      tempTextarea.value = textToCopy;
      tempTextarea.style.position = 'fixed';
      tempTextarea.style.opacity = '0';
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand('copy');
      document.body.removeChild(tempTextarea);
      copied = true;
    }

    // 요구사항 3-4: '복사하였습니다' 알림창이 나타나게 해 줘.
    alert('복사하였습니다');

    // 시각적 토스트 알림도 함께 표시
    showToast('복사하였습니다', 'success');
  });

  // QR코드 만들기 연동 버튼
  makeQrBtn.addEventListener('click', () => {
    const shortUrl = resultUrlInput.value.trim();
    if (!shortUrl) return;
    // url2qr 서비스로 파라미터를 넘겨 이동
    window.location.href = `../url2qr/index.html?url=${encodeURIComponent(shortUrl)}`;
  });

  // 7. 최근 단축 내역 (History) 관리
  function loadHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveToHistory(orig, short) {
    // 중복 제거 후 최신 항목을 상단에 추가
    historyData = historyData.filter(item => item.short !== short);
    historyData.unshift({
      orig,
      short,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    });
    // 최대 10개 유지
    if (historyData.length > 10) historyData = historyData.slice(0, 10);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData));
    } catch (e) {
      console.warn('localStorage 저장 오류:', e);
    }
  }

  function renderHistory() {
    if (!historyList) return;

    historyCount.textContent = historyData.length;
    clearHistoryBtn.hidden = historyData.length === 0;

    if (historyData.length === 0) {
      historyList.innerHTML = `
        <div class="empty-history" id="emptyHistory">
          <p>아직 생성된 단축 URL이 없습니다. 긴 URL을 입력해 보세요!</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = historyData.map((item, index) => `
      <div class="history-item">
        <div class="history-urls">
          <a href="${escapeHtml(item.short)}" target="_blank" rel="noopener noreferrer" class="history-short" title="새 탭에서 열기">
            ${escapeHtml(item.short)}
          </a>
          <div class="history-orig" title="${escapeHtml(item.orig)}">${escapeHtml(item.orig)}</div>
        </div>
        <div class="history-actions">
          <button type="button" class="history-copy-btn" data-url="${escapeHtml(item.short)}" title="클립보드 복사">
            복사
          </button>
          <button type="button" class="history-delete-btn" data-index="${index}" title="항목 삭제">
            삭제
          </button>
        </div>
      </div>
    `).join('');

    // 히스토리 항목별 이벤트 바인딩
    historyList.querySelectorAll('.history-copy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        if (url) {
          try {
            await navigator.clipboard.writeText(url);
          } catch (err) {
            const t = document.createElement('textarea');
            t.value = url;
            document.body.appendChild(t);
            t.select();
            document.execCommand('copy');
            document.body.removeChild(t);
          }
          alert('복사하였습니다');
          showToast('복사하였습니다', 'success');
        }
      });
    });

    historyList.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        if (!isNaN(index)) {
          historyData.splice(index, 1);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(historyData));
          renderHistory();
          showToast('내역에서 삭제되었습니다.', 'info');
        }
      });
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('최근 단축 내역을 모두 삭제하시겠습니까?')) {
      historyData = [];
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
      showToast('모든 단축 내역이 삭제되었습니다.', 'info');
    }
  });

  // 8. 토스트 알림 함수
  function showToast(message, type = 'success') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconSvg = type === 'success'
      ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
         </svg>`
      : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
         </svg>`;

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode === toastContainer) {
          toastContainer.removeChild(toast);
        }
      }, 350);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 초기 렌더링
  renderHistory();
  urlInput.focus();
});
