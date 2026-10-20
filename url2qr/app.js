/**
 * URL2QR - Interaction, Dynamic Mouse-Driven Gradients & JPG Export Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Elements
  const body = document.body;
  const root = document.documentElement;
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const submitBtn = document.getElementById('submitBtn');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const formFeedback = document.getElementById('formFeedback');
  const resetBtn = document.getElementById('resetBtn');
  const brandLogo = document.getElementById('brandLogo');

  const qrResultSection = document.getElementById('qrResultSection');
  const qrCard = document.getElementById('qrCard');
  const qrcodeContainer = document.getElementById('qrcode');
  const urlDisplayText = document.getElementById('urlDisplayText');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const directDownloadBtn = document.getElementById('directDownloadBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Background interactive elements
  const cursorFollower = document.getElementById('cursorGlowFollower');
  const glowSphere1 = document.getElementById('glowSphere1');
  const glowSphere2 = document.getElementById('glowSphere2');
  const glowSphere3 = document.getElementById('glowSphere3');
  const glowSphere4 = document.getElementById('glowSphere4');

  // 2. Application State
  let currentQrInstance = null;
  let currentFormattedUrl = '';

  // 3. Mouse-driven Interactive Dynamic Gradient System
  let mouseTargetX = window.innerWidth / 2;
  let mouseTargetY = window.innerHeight / 2;
  let currentMouseX = mouseTargetX;
  let currentMouseY = mouseTargetY;
  let isMouseMoving = false;
  let rafId = null;

  function updateMouseGradient() {
    // Smooth lerp (linear interpolation) for silky butter motion
    const lerpFactor = 0.12;
    currentMouseX += (mouseTargetX - currentMouseX) * lerpFactor;
    currentMouseY += (mouseTargetY - currentMouseY) * lerpFactor;

    const width = window.innerWidth || 1200;
    const height = window.innerHeight || 800;

    const normX = Math.max(0, Math.min(1, currentMouseX / width));
    const normY = Math.max(0, Math.min(1, currentMouseY / height));

    // Dynamic HSL Hue angles shifting around Pale Orange Pastel palette (15° to 30°)
    // Left: warm blush → Center: soft orange → Right: light apricot
    const dynamicHue1 = Math.round(22 + normX * 8 + (1 - normY) * 4);
    const dynamicHue2 = Math.round(16 + normY * 8 + normX * 6);
    const dynamicHue3 = Math.round(27 + (1 - normX) * 6 + normY * 4);
    const dynamicHue4 = Math.round(19 + normX * 7 + normY * 6);

    // Apply reactive CSS variables to root
    root.style.setProperty('--mouse-x', `${Math.round(currentMouseX)}px`);
    root.style.setProperty('--mouse-y', `${Math.round(currentMouseY)}px`);
    root.style.setProperty('--dynamic-hue-1', dynamicHue1);
    root.style.setProperty('--dynamic-hue-2', dynamicHue2);
    root.style.setProperty('--dynamic-hue-3', dynamicHue3);
    root.style.setProperty('--dynamic-hue-4', dynamicHue4);

    // Subtle parallax motion for floating ambient orbs
    const offsetX = (normX - 0.5) * 40;
    const offsetY = (normY - 0.5) * 40;

    if (glowSphere1) {
      glowSphere1.style.transform = `translate(${offsetX * 0.8}px, ${offsetY * 0.8}px)`;
    }
    if (glowSphere2) {
      glowSphere2.style.transform = `translate(${-offsetX * 0.9}px, ${-offsetY * 0.9}px)`;
    }
    if (glowSphere3) {
      glowSphere3.style.transform = `translate(calc(-50% + ${offsetX * 0.5}px), calc(-50% + ${offsetY * 0.5}px))`;
    }
    if (glowSphere4) {
      glowSphere4.style.transform = `translate(${-offsetX * 0.6}px, ${offsetY * 0.6}px)`;
    }

    // Continue animation loop while moving or close to target
    const dist = Math.hypot(mouseTargetX - currentMouseX, mouseTargetY - currentMouseY);
    if (dist > 0.5 || isMouseMoving) {
      rafId = requestAnimationFrame(updateMouseGradient);
    } else {
      rafId = null;
    }
  }

  function handlePointerMove(e) {
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);

    if (clientX != null && clientY != null) {
      mouseTargetX = clientX;
      mouseTargetY = clientY;
      isMouseMoving = true;

      if (!rafId) {
        rafId = requestAnimationFrame(updateMouseGradient);
      }
    }
  }

  window.addEventListener('mousemove', handlePointerMove, { passive: true });
  window.addEventListener('touchmove', handlePointerMove, { passive: true });

  // Initial trigger to set colors on load
  updateMouseGradient();

  // 4. Helper: Toast Notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconSvg = type === 'success' 
      ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
         </svg>`
      : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
         </svg>`;

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove after 3.2 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3200);
  }

  // 5. Helper: Show/Clear Form Feedback
  function showError(msg) {
    formFeedback.textContent = msg;
    formFeedback.classList.add('is-error');
  }

  function clearError() {
    formFeedback.textContent = '';
    formFeedback.classList.remove('is-error');
  }

  // 6. URL Normalization
  function normalizeUrl(rawUrl) {
    let trimmed = rawUrl.trim();
    if (!trimmed) return '';

    // If it doesn't start with a protocol or mailto/tel, prepend https://
    if (!/^[a-zA-Z]+:\/\//i.test(trimmed) && !/^(mailto|tel|sms):/i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    return trimmed;
  }

  // 7. Generate QR Code
  function generateQrCode(targetUrl) {
    // Clear previous QR element
    qrcodeContainer.innerHTML = '';

    // Create new QRCode instance (260x260 for crisp screen preview with Level H)
    currentQrInstance = new QRCode(qrcodeContainer, {
      text: targetUrl,
      width: 260,
      height: 260,
      colorDark: '#18181b', // Matching logo jet-black
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    currentFormattedUrl = targetUrl;
    urlDisplayText.textContent = targetUrl;

    // Transition state: move input down, display QR in center
    body.classList.add('has-qr');
    qrResultSection.hidden = false;

    // Smooth scroll if viewport is tight
    if (window.innerWidth < 640) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    clearError();
  }

  // 8. High-Resolution JPG Downloader
  // Ensures white background and crystal-sharp 1200x1200px export
  function downloadQrAsJpg() {
    if (!currentQrInstance) {
      showError('먼저 QR 코드를 생성해 주세요.');
      return;
    }

    try {
      const exportSize = 1200;
      const margin = 100;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportSize;
      exportCanvas.height = exportSize;
      const ctx = exportCanvas.getContext('2d');

      // 1) Fill solid white background (MANDATORY for JPG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportSize, exportSize);

      // 2) Render directly from QR matrix for maximum vector-like sharpness
      const qrObj = currentQrInstance._oQRCode;
      if (qrObj && typeof qrObj.getModuleCount === 'function') {
        const moduleCount = qrObj.getModuleCount();
        const drawAreaSize = exportSize - (margin * 2);
        const cellSize = drawAreaSize / moduleCount;

        ctx.fillStyle = '#18181b'; // Jet-black module matching logo typography
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qrObj.isDark(row, col)) {
              ctx.fillRect(
                Math.round(margin + col * cellSize),
                Math.round(margin + row * cellSize),
                Math.ceil(cellSize),
                Math.ceil(cellSize)
              );
            }
          }
        }
      } else {
        // Fallback: draw from existing rendered canvas/image
        const renderedCanvas = qrcodeContainer.querySelector('canvas');
        const renderedImg = qrcodeContainer.querySelector('img');

        if (renderedCanvas) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(renderedCanvas, margin, margin, exportSize - margin * 2, exportSize - margin * 2);
        } else if (renderedImg && renderedImg.complete) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(renderedImg, margin, margin, exportSize - margin * 2, exportSize - margin * 2);
        }
      }

      // 3) Create sanitized filename based on domain & timestamp
      let domainPart = 'qrcode';
      try {
        const parsed = new URL(currentFormattedUrl);
        domainPart = parsed.hostname.replace(/[^a-zA-Z0-9]/g, '_') || 'qrcode';
      } catch (e) {
        domainPart = 'qrcode';
      }

      const now = new Date();
      const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `qr_${domainPart}_${timeStr}.jpg`;

      // 4) Export as high quality JPEG (quality 0.95)
      const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.95);
      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // 5) Visual feedback
      showToast(`JPG 파일이 다운로드되었습니다 (${filename})`, 'success');
      
      // Card bounce feedback animation
      qrCard.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.97)' },
        { transform: 'scale(1.02)' },
        { transform: 'scale(1)' }
      ], {
        duration: 350,
        easing: 'ease-out'
      });

    } catch (err) {
      console.error('Download error:', err);
      showToast('이미지 다운로드 중 오류가 발생했습니다.', 'error');
    }
  }

  // 9. Event Listeners

  // Form Submit
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawVal = urlInput.value;
    if (!rawVal.trim()) {
      showError('URL 또는 웹 링크를 입력해 주세요.');
      urlInput.focus();
      return;
    }

    const normalized = normalizeUrl(rawVal);
    urlInput.value = normalized;
    generateQrCode(normalized);
  });

  // Clear button logic
  urlInput.addEventListener('input', () => {
    clearError();
    if (urlInput.value.length > 0) {
      clearInputBtn.hidden = false;
    } else {
      clearInputBtn.hidden = true;
    }
  });

  clearInputBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearInputBtn.hidden = true;
    clearError();
    urlInput.focus();
  });

  // QR Card Click -> JPG Download
  qrCard.addEventListener('click', () => {
    downloadQrAsJpg();
  });

  // Keyboard accessibility
  qrCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      downloadQrAsJpg();
    }
  });

  // Direct download button
  directDownloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadQrAsJpg();
  });

  // Copy URL button
  copyUrlBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentFormattedUrl) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentFormattedUrl);
        showToast('URL이 클립보드에 복사되었습니다!', 'success');
      } else {
        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = currentFormattedUrl;
        document.body.appendChild(tempTextarea);
        tempTextarea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextarea);
        showToast('URL이 클립보드에 복사되었습니다!', 'success');
      }
    } catch (err) {
      showToast('URL 복사에 실패했습니다.', 'error');
    }
  });

  // Reset to initial centered state
  function resetToInitial() {
    body.classList.remove('has-qr');
    qrResultSection.hidden = true;
    urlInput.value = '';
    clearInputBtn.hidden = true;
    clearError();
    currentQrInstance = null;
    currentFormattedUrl = '';
    setTimeout(() => {
      urlInput.focus();
    }, 300);
  }

  resetBtn.addEventListener('click', resetToInitial);
  brandLogo.addEventListener('click', (e) => {
    e.preventDefault();
    resetToInitial();
  });

  // Auto generate if url query param exists
  const queryParamUrl = new URLSearchParams(window.location.search).get('url');
  if (queryParamUrl) {
    urlInput.value = queryParamUrl;
    clearInputBtn.hidden = false;
    setTimeout(() => {
      handleFormSubmit();
    }, 150);
  } else {
    // Initial focus
    urlInput.focus();
  }
});
