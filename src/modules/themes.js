import { getStorageItem, setStorageItem } from '../utils/storage.js';

const THEME_KEY = 'radhe_theme_settings';

const defaultTheme = {
  accent: '#667eea',
  font: 'Inter',
  pattern: 'none'
};

export function initThemes() {
  const theme = getStorageItem(THEME_KEY, defaultTheme);
  
  applyTheme(theme);
  setupThemeEvents(theme);
}

function applyTheme(theme) {
  // Update CSS variables
  document.documentElement.style.setProperty('--accent', theme.accent);
  
  // Convert HEX to RGB for shadow effects
  const rgb = hexToRgb(theme.accent);
  if (rgb) {
    document.documentElement.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
  
  // Set font
  if (theme.font === 'Inter') {
    document.documentElement.style.setProperty('--font-sans', "'Inter', sans-serif");
  } else if (theme.font === 'Outfit') {
    document.documentElement.style.setProperty('--font-sans', "'Outfit', sans-serif");
  } else if (theme.font === 'Georgia') {
    document.documentElement.style.setProperty('--font-sans', "Georgia, serif");
  } else {
    document.documentElement.style.setProperty('--font-sans', "monospace");
  }
  
  // Set pattern class on body
  document.body.className = ''; // Reset
  if (theme.pattern !== 'none') {
    document.body.classList.add(`pattern-${theme.pattern}`);
  }
  
  // Add CSS custom rules dynamically if patterns are selected
  let styleEl = document.getElementById('theme-pattern-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'theme-pattern-styles';
    document.head.appendChild(styleEl);
  }
  
  if (theme.pattern === 'dots') {
    styleEl.innerHTML = `
      body.pattern-dots {
        background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0);
        background-size: 24px 24px;
      }
    `;
  } else if (theme.pattern === 'grid') {
    styleEl.innerHTML = `
      body.pattern-grid {
        background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 20px 20px;
      }
    `;
  } else if (theme.pattern === 'noise') {
    styleEl.innerHTML = `
      body.pattern-noise {
        background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 2px, transparent 2px, transparent 4px);
      }
    `;
  } else {
    styleEl.innerHTML = '';
  }
  
  // Update theme settings form elements
  const swatchBtn = document.querySelector(`.swatch[data-color="${theme.accent}"]`);
  if (swatchBtn) {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    swatchBtn.classList.add('active');
  }
  
  document.getElementById('font-picker').value = theme.font;
  
  const patternBtn = document.querySelector(`.pattern-btn[data-pattern="${theme.pattern}"]`);
  if (patternBtn) {
    document.querySelectorAll('.pattern-btn').forEach(p => p.classList.remove('active'));
    patternBtn.classList.add('active');
  }
}

function setupThemeEvents(theme) {
  // Swatches
  document.getElementById('color-swatches').addEventListener('click', (e) => {
    const swatch = e.target.closest('.swatch');
    if (!swatch) return;
    
    theme.accent = swatch.dataset.color;
    setStorageItem(THEME_KEY, theme);
    applyTheme(theme);
  });
  
  // Font picker
  document.getElementById('font-picker').addEventListener('change', (e) => {
    theme.font = e.target.value;
    setStorageItem(THEME_KEY, theme);
    applyTheme(theme);
  });
  
  // Pattern picker
  document.getElementById('pattern-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.pattern-btn');
    if (!btn) return;
    
    theme.pattern = btn.dataset.pattern;
    setStorageItem(THEME_KEY, theme);
    applyTheme(theme);
  });
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
