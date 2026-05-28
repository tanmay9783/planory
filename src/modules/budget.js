import { getStorageItem, setStorageItem } from '../utils/storage.js';
import { formatDate } from '../utils/date.js';

const BUDGET_SETTINGS_KEY = 'radhe_budget_settings';
const EXPENSES_KEY = 'radhe_expenses';

const defaultSettings = {
  monthlyLimit: 10000,
  savingsGoalName: 'Headphones',
  savingsGoalTarget: 2000,
  savingsGoalCurrent: 600
};

export function initBudgetTracker() {
  const settings = getStorageItem(BUDGET_SETTINGS_KEY, defaultSettings);
  const expenses = getStorageItem(EXPENSES_KEY, []);
  
  updateBudgetUI(settings, expenses);
  setupBudgetEvents(settings, expenses);
}

function updateBudgetUI(settings, expenses) {
  // Calculate total monthly expense
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const monthlyExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.date);
    return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
  });
  
  const totalSpent = monthlyExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  
  // Update spending ratio text
  const spendingRatio = document.getElementById('budget-spending-ratio');
  if (spendingRatio) {
    spendingRatio.textContent = `₹${totalSpent} / ₹${settings.monthlyLimit}`;
  }
  
  // Progress Bar Fill
  const fillBar = document.getElementById('budget-progress-fill');
  if (fillBar) {
    let pct = (totalSpent / settings.monthlyLimit) * 100;
    if (pct > 100) pct = 100;
    fillBar.style.width = `${pct}%`;
    
    // Visual warning near 80% limit
    const warningLabel = document.getElementById('budget-warning-label');
    if (pct >= 80) {
      fillBar.style.background = 'var(--color-high)'; // Orange/Red warning
      if (warningLabel) warningLabel.classList.remove('hidden');
    } else {
      fillBar.style.background = 'var(--accent-gradient)';
      if (warningLabel) warningLabel.classList.add('hidden');
    }
  }
  
  // Update Savings Goal details
  const savingsLabel = document.getElementById('savings-goal-label');
  if (savingsLabel) {
    savingsLabel.textContent = `Goal: ${settings.savingsGoalName}`;
  }
  
  const savingsRatio = document.getElementById('savings-progress-ratio');
  if (savingsRatio) {
    savingsRatio.textContent = `₹${settings.savingsGoalCurrent} / ₹${settings.savingsGoalTarget}`;
  }
  
  const savingsFill = document.getElementById('savings-progress-fill');
  if (savingsFill) {
    let savingsPct = (settings.savingsGoalCurrent / settings.savingsGoalTarget) * 100;
    if (savingsPct > 100) savingsPct = 100;
    savingsFill.style.width = `${savingsPct}%`;
  }
  
  // Update Settings Inputs
  const limitInput = document.getElementById('settings-budget-limit');
  if (limitInput) limitInput.value = settings.monthlyLimit;
  
  const goalNameInput = document.getElementById('settings-savings-name');
  if (goalNameInput) goalNameInput.value = settings.savingsGoalName;
  
  const goalTargetInput = document.getElementById('settings-savings-target');
  if (goalTargetInput) goalTargetInput.value = settings.savingsGoalTarget;
  
  // Update Insights
  renderInsights(monthlyExpenses, totalSpent);
  
  // Update Logs List
  renderLogsList(expenses, settings);
}

function renderInsights(monthlyExpenses, totalSpent) {
  const box = document.getElementById('insights-box');
  if (!box) return;
  
  if (monthlyExpenses.length === 0 || totalSpent === 0) {
    box.innerHTML = `<p class="helper-text">Add your daily expenses to see smart student insights here! 📊</p>`;
    return;
  }
  
  // Group by category
  const categoriesMap = {};
  monthlyExpenses.forEach(exp => {
    categoriesMap[exp.category] = (categoriesMap[exp.category] || 0) + parseFloat(exp.amount);
  });
  
  // Find highest category
  let maxCat = '';
  let maxVal = 0;
  Object.keys(categoriesMap).forEach(cat => {
    if (categoriesMap[cat] > maxVal) {
      maxVal = categoriesMap[cat];
      maxCat = cat;
    }
  });
  
  const pct = Math.round((maxVal / totalSpent) * 100);
  
  // Suggest cuts dynamically based on highest category
  let advice = "Keep up the consistent tracking!";
  if (maxCat === 'Food') {
    advice = "Try cooking in or checking pocket-friendly campus canteens to cut down next week! 🍔";
  } else if (maxCat === 'Transport') {
    advice = "Look into monthly student bus/metro passes to save a major chunk on travel! 🚌";
  } else if (maxCat === 'Entertainment') {
    advice = "Look out for movie discount days or split student subscriptions to save! 🎬";
  } else if (maxCat === 'Books') {
    advice = "Consider renting second-hand books or splitting library cards with classmates! 📚";
  }
  
  box.innerHTML = `
    <strong>💡 EOM Budget Insight:</strong><br/>
    You spent <span style="color:var(--color-high); font-weight:bold;">${pct}%</span> of your monthly fund on <strong style="color:#fff">${maxCat}</strong> (₹${maxVal}).<br/>
    <div style="margin-top:6px; color:var(--text-secondary)">${advice}</div>
  `;
}

function renderLogsList(expenses, settings) {
  const container = document.getElementById('expense-logs-list');
  if (!container) return;
  container.innerHTML = '';
  
  if (expenses.length === 0) {
    container.innerHTML = `<p class="helper-text" style="padding: 10px 0; text-align:center;">No logged expenses yet.</p>`;
    return;
  }
  
  // Sort by date descending
  const sorted = [...expenses].sort((a,b) => b.date.localeCompare(a.date));
  
  sorted.forEach((exp) => {
    const row = document.createElement('div');
    row.className = 'habit-row'; // Reuse habit row style
    row.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:600; font-size:13px;">${exp.category}: ₹${exp.amount}</span>
        <span class="helper-text">${exp.notes ? exp.notes + ' • ' : ''}${exp.date}</span>
      </div>
      <button class="icon-btn delete-expense" data-id="${exp.id}" title="Delete Log">🗑️</button>
    `;
    container.appendChild(row);
  });
  
  // Hook deletes
  container.querySelectorAll('.delete-expense').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const updated = expenses.filter(e => e.id !== id);
      setStorageItem(EXPENSES_KEY, updated);
      initBudgetTracker(); // Refresh
    });
  });
}

function setupBudgetEvents(settings, expenses) {
  const addBtn = document.getElementById('budget-add-expense-btn');
  const overlay = document.getElementById('expense-modal-overlay');
  const closeBtn = document.getElementById('expense-close-btn');
  const cancelBtn = document.getElementById('expense-cancel-btn');
  const saveBtn = document.getElementById('expense-save-btn');
  
  const openInsightsBtn = document.getElementById('open-budget-insights-btn');
  const insightsOverlay = document.getElementById('budget-insights-modal-overlay');
  const closeInsightsBtn = document.getElementById('insights-close-btn');
  
  // Modal triggers
  if (addBtn && overlay) {
    addBtn.addEventListener('click', () => {
      document.getElementById('expense-amount').value = '';
      document.getElementById('expense-notes').value = '';
      document.getElementById('expense-date').value = formatDate(new Date());
      document.getElementById('expense-category').value = 'Food';
      overlay.classList.remove('hidden');
    });
  }
  
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  }
  if (cancelBtn && overlay) {
    cancelBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  }
  
  if (saveBtn && overlay) {
    saveBtn.addEventListener('click', () => {
      const amount = document.getElementById('expense-amount').value.trim();
      if (!amount || parseFloat(amount) <= 0) {
        alert("Please enter a valid expense amount.");
        return;
      }
      
      const category = document.getElementById('expense-category').value;
      const date = document.getElementById('expense-date').value;
      const notes = document.getElementById('expense-notes').value.trim();
      
      const newExpense = {
        id: 'exp_' + Date.now(),
        amount: parseFloat(amount),
        category,
        date,
        notes
      };
      
      expenses.push(newExpense);
      setStorageItem(EXPENSES_KEY, expenses);
      overlay.classList.add('hidden');
      
      initBudgetTracker();
      showToast("Expense logged successfully! 💸");
    });
  }
  
  // Insights panel triggers
  if (openInsightsBtn && insightsOverlay) {
    openInsightsBtn.addEventListener('click', () => {
      insightsOverlay.classList.remove('hidden');
    });
  }
  
  if (closeInsightsBtn && insightsOverlay) {
    closeInsightsBtn.addEventListener('click', () => {
      insightsOverlay.classList.add('hidden');
    });
  }
  
  // Save Settings Trigger
  const saveSettingsBtn = document.getElementById('save-budget-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const limit = document.getElementById('settings-budget-limit').value.trim();
      const name = document.getElementById('settings-savings-name').value.trim();
      const target = document.getElementById('settings-savings-target').value.trim();
      
      if (limit) settings.monthlyLimit = parseInt(limit);
      if (name) settings.savingsGoalName = name;
      if (target) settings.savingsGoalTarget = parseInt(target);
      
      setStorageItem(BUDGET_SETTINGS_KEY, settings);
      initBudgetTracker();
      showToast("Budget limits saved! 💰");
    });
  }
  
  // Add direct savings goal cash
  const addSavingsBtn = document.getElementById('settings-savings-add-btn');
  if (addSavingsBtn) {
    addSavingsBtn.addEventListener('click', () => {
      const addInput = document.getElementById('settings-savings-add-amount');
      if (!addInput) return;
      const cash = addInput.value.trim();
      if (!cash || parseFloat(cash) <= 0) return;
      
      settings.savingsGoalCurrent = Math.min(settings.savingsGoalTarget, settings.savingsGoalCurrent + parseInt(cash));
      setStorageItem(BUDGET_SETTINGS_KEY, settings);
      addInput.value = '';
      
      initBudgetTracker();
      showToast(`Added ₹${cash} to goal! 🎉`);
    });
  }
}

function showToast(msg) {
  const toast = document.getElementById('notif-toast');
  if (toast) {
    document.getElementById('notif-msg').textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }
}
