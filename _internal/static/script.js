document.addEventListener('DOMContentLoaded', () => {
    const initialDataElement = document.getElementById('initial-data');
    if (initialDataElement) {
        const initialData = JSON.parse(initialDataElement.textContent || '{}');
        window.investments = initialData.investments || [];
        window.caseNames = initialData.case_names || [];
        window.releaseYears = initialData.release_years || {};
        window.releaseDates = initialData.release_dates || {};

        loadInvestments();
        setupEventListeners();
        setupApiKeyListener();

        fetch('/price_history')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    renderPriceStrip(data.prices, window.investments);
                } else {
                    console.error('Failed to load price history:', data.message);
                }
            })
            .catch(err => console.error('Fetch error:', err));
    } else {
        console.error('Initial data script tag not found');
    }
});

function setupEventListeners() {
    const addBtn = document.querySelector('.add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', showCaseSelector);
    } else {
        console.error('Add button not found');
    }

    document.addEventListener('click', (e) => {
        const flippedCards = document.querySelectorAll('.card.flipped');
        let isOverFlippedCard = false;
        flippedCards.forEach(card => {
            if (card.contains(e.target)) isOverFlippedCard = true;
        });
        if (!isOverFlippedCard) {
            document.body.classList.remove('no-scroll');
        }
    });

    document.addEventListener('wheel', (e) => {
        if (document.body.classList.contains('no-scroll')) {
            e.preventDefault();
        }
    }, { passive: false });

    let lastScrollPosition = 0;
    document.addEventListener('scroll', () => {
        lastScrollPosition = window.scrollY;
    }, { passive: true });

    document.addEventListener('mouseleave', (e) => {
        const flippedCards = document.querySelectorAll('.card.flipped');
        let isOverFlippedCard = false;
        flippedCards.forEach(card => {
            if (card.contains(e.target)) isOverFlippedCard = true;
        });
        if (!isOverFlippedCard && document.body.classList.contains('no-scroll')) {
            document.body.classList.remove('no-scroll');
            window.scrollTo(0, lastScrollPosition);
        }
    }, { passive: true });
}

function setupApiKeyListener() {
    const apiKeySection = document.getElementById('api-key-section');
    if (apiKeySection && !apiKeySection.querySelector('.api-key-valid')) {
        const saveBtn = document.getElementById('api-key-input');
        if (saveBtn) {
            saveBtn.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveApiKey();
                }
            });
        }
    }
}

function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyStatus = document.getElementById('api-key-status');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        apiKeyStatus.textContent = 'X';
        return;
    }

    fetch('/set_api_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `api_key=${encodeURIComponent(apiKey)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            apiKeyStatus.textContent = '';
            apiKeyInput.style.display = 'none';
            document.querySelector('#api-key-section button').style.display = 'none';
            apiKeyStatus.textContent = '✓';
            apiKeyStatus.className = 'api-key-valid';
            location.reload();
        } else {
            apiKeyStatus.textContent = 'X';
            apiKeyInput.value = '';
        }
    })
    .catch(error => {
        console.error('Error setting API key:', error);
        apiKeyStatus.textContent = 'X';
        apiKeyInput.value = '';
    });
}

function loadInvestments() {
    renderCards(window.investments);
    updateTotals(window.investments);
}

function renderCards(investments) {
    const container = document.getElementById('cards-container');
    if (container) {
        container.innerHTML = '';
        if (!investments || investments.length === 0) {
            console.warn('No investments to render');
            return;
        }
        investments.forEach((inv, index) => {
            const profitLoss = inv.lowest_price !== null ? inv.quantity * (inv.lowest_price - inv.purchase_price) : 0;
            const roi = inv.lowest_price !== null && inv.purchase_price !== 0 ? ((inv.lowest_price - inv.purchase_price) / inv.purchase_price * 100).toFixed(2) : 0;
            const dropStatus = getDropStatus(inv.item_name);
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.index = index;
            card.draggable = true;
            card.innerHTML = `
                <div class="card-front">
                    <div class="card-header">
                        <img src="/static/images/${inv.item_name.toLowerCase().replace(/ /g, '_')}.webp" alt="${inv.item_name}" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='">
                        <span>${inv.item_name} (${window.releaseYears[inv.item_name] || 'N/A'})</span>
                        <button class="remove-btn" onclick="showConfirmRemoveModal(${index})">X</button>
                    </div>
                    <div class="card-content">
                        <div class="split-container">
                            <div class="left-section">
                                <div><h4>Your Investment</h4></div>
                                <div class="input-group">
                                    <span>Qty:</span>
                                    <span class="static-value"><b>${inv.quantity}</b></span>
                                    <button class="adjust-btn" onclick="showTransactionModal(${index}, 'buy')">+</button>
                                    <button class="adjust-btn minus-btn" onclick="showTransactionModal(${index}, 'sell')">-</button>
                                </div>
                                <div class="input-group">
                                    <span>Per Case:</span>
                                    <span class="static-value"><b>$${inv.purchase_price.toFixed(2)}</b></span>
                                </div>
                                <div class="value-box">
                                    Total: $${(inv.quantity * inv.purchase_price).toFixed(2)}
                                </div>
                            </div>
                            <div class="right-section">
                                <div><h4>Current Value</h4></div>
                                <div class="value-box">
                                    Case Price: $${inv.lowest_price !== null ? inv.lowest_price.toFixed(2) : '0.00'}
                                </div>
                                <div class="profit-loss" style="color: ${profitLoss >= 0 ? 'rgb(76, 145, 76)' : 'rgb(126, 33, 33)'}">
                                    ${profitLoss > 0 ? 'Profit:' : profitLoss < 0 ? 'Loss:' : 'Profit/Loss:'} $${profitLoss.toFixed(2)}
                                </div>
                                <div class="value-box">
                                    Total: $${inv.lowest_price !== null ? (inv.quantity * inv.lowest_price).toFixed(2) : '0.00'}
                                </div>
                            </div>
                        </div>
                        <div class="card-footer">
                            <span class="drop-status"><b>[${dropStatus}]</b></span>
                            <span class="roi">ROI: <b>${roi}%</b></span>
                        </div>
                    </div>
                </div>
                <div class="card-back">
                    <div class="ledger-container ${inv.transactions && inv.transactions.length > 8 ? 'scrollable' : ''}">
                        ${renderLedger(inv.transactions || [])}
                    </div>
                </div>
            `;
            const valueBoxInvestment = card.querySelector('.left-section .value-box');
            const valueBoxTotalValue = card.querySelectorAll('.right-section .value-box')[1];
            if (inv.lowest_price !== null) {
                const pl = inv.quantity * (inv.lowest_price - inv.purchase_price);
                valueBoxInvestment.style.backgroundColor = '#2a2a2a';
                valueBoxTotalValue.style.backgroundColor = pl >= 0 ? 'rgb(76, 145, 76)' : 'rgb(126, 33, 33)';
            }

            card.addEventListener('click', (e) => {
                if (!e.target.closest('button') && !e.target.closest('input')) {
                    card.classList.toggle('flipped');
                    const ledgerContainer = card.querySelector('.ledger-container');
                    if (ledgerContainer && ledgerContainer.classList.contains('scrollable')) {
                        ledgerContainer.scrollTop = ledgerContainer.scrollHeight;
                    }
                }
            });

            card.addEventListener('mouseenter', (e) => {
                if (card.classList.contains('flipped')) {
                    document.body.classList.add('no-scroll');
                }
            });

            card.addEventListener('mouseleave', (e) => {
                if (card.classList.contains('flipped') && !card.contains(e.relatedTarget)) {
                    document.body.classList.remove('no-scroll');
                }
            });

            const ledgerContainer = card.querySelector('.ledger-container');
            if (ledgerContainer && ledgerContainer.classList.contains('scrollable')) {
                ledgerContainer.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const scrollAmount = e.deltaY * 0.5;
                    ledgerContainer.scrollTop += scrollAmount;
                }, { passive: false });
            }

            const caseImage = card.querySelector('.card-header img');
            card.addEventListener('dragstart', (e) => {
                if (e.target === caseImage) {
                    e.dataTransfer.setData('text/plain', index);
                    card.classList.add('dragging');
                } else {
                    e.preventDefault();
                }
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const targetIndex = parseInt(card.dataset.index);
                if (draggedIndex !== targetIndex) {
                    reorderInvestments(draggedIndex, targetIndex);
                }
            });

            container.appendChild(card);
        });
    } else {
        console.error('Cards container not found');
    }
}

function renderLedger(transactions) {
    const MIN_ROWS = 8;
    if (!transactions || transactions.length === 0) {
        const emptyRows = Array(MIN_ROWS).fill(`
            <tr>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            </tr>
        `).join('');
        return `
            <table class="ledger-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Qty</th>
                        <th>Bought</th>
                        <th>Sold</th>
                    </tr>
                </thead>
                <tbody>
                    ${emptyRows}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2">Totals:</td>
                        <td>$0.00</td>
                        <td>$0.00</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    const rows = transactions.map(t => {
        const debit = t.type === 'buy' ? (t.quantity * t.price_per_case).toFixed(2) : '0.00';
        const credit = t.type === 'sell' ? (t.quantity * t.price_per_case).toFixed(2) : '0.00';
        totalDebit += parseFloat(debit);
        totalCredit += parseFloat(credit);
        
        const dateObj = new Date(t.date);
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('default', { month: 'long' });
        const day = dateObj.getDate();
        const dayWithSuffix = addDaySuffix(day);
        const formattedDate = `${year} ${month} ${dayWithSuffix}`;

        return `
            <tr>
                <td>${formattedDate}</td>
                <td>${t.quantity}</td>
                <td>$${debit}</td>
                <td>$${credit}</td>
            </tr>
        `;
    });

    const remainingRows = MIN_ROWS - transactions.length;
    const emptyRows = remainingRows > 0 ? Array(remainingRows).fill(`
        <tr>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
        </tr>
    `).join('') : '';

    return `
        <table class="ledger-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Qty</th>
                    <th>Bought</th>
                    <th>Sold</th>
                </tr>
            </thead>
            <tbody>
                ${emptyRows}
                ${rows.join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2">Totals:</td>
                    <td>$${totalDebit.toFixed(2)}</td>
                    <td>$${totalCredit.toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
    `;
}

function addDaySuffix(day) {
    if (day >= 11 && day <= 13) {
        return `${day}th`;
    }
    switch (day % 10) {
        case 1: return `${day}st`;
        case 2: return `${day}nd`;
        case 3: return `${day}rd`;
        default: return `${day}th`;
    }
}

function calculateTotalBought(transactions) {
    if (!transactions) return 0;
    return transactions
        .filter(t => t.type === 'buy')
        .reduce((sum, t) => sum + t.total, 0);
}

function getDropStatus(caseName) {
    const activeDrops = ["Kilowatt Case", "Revolution Case", "Recoil Case", "Dreams & Nightmares Case", "Fracture Case"];
    const rareDrops = [
        "Snakebite Case", "Prisma 2 Case", "CS20 Case", "Prisma Case", "Danger Zone Case",
        "Horizon Case", "Clutch Case", "Spectrum 2 Case", "Operation Hydra Case", "Spectrum Case",
        "Glove Case", "Gamma 2 Case", "Gamma Case", "Chroma 3 Case", "Operation Wildfire Case",
        "Revolver Case", "Shadow Case", "Falchion Case", "Chroma 2 Case", "Chroma Case",
        "Operation Vanguard Case", "Operation Breakout Case", "Huntsman Case", "Operation Phoenix Case",
        "CSGO Weapon Case 3", "Winter Offensive Case", "Operation Bravo Case", "CSGO Weapon Case 2", "CSGO Weapon Case"
    ];
    const armory = ["Fever Case", "Gallery Case"];
    const discontinued = ["Operation Riptide Case", "Operation Broken Fang Case", "Shattered Web Case"];

    if (activeDrops.includes(caseName)) return "Active Drop";
    if (rareDrops.includes(caseName)) return "Rare Drop";
    if (armory.includes(caseName)) return "Armory";
    if (discontinued.includes(caseName)) return "Discontinued";
    return "Unknown";
}

function updateTotals(investments) {
    const totalInvested = investments.reduce((sum, inv) => sum + inv.quantity * inv.purchase_price, 0).toFixed(2);
    const totalValue = investments.reduce((sum, inv) => sum + inv.quantity * (inv.lowest_price || 0), 0).toFixed(2);
    const totalPL = (totalValue - totalInvested).toFixed(2);
    const totalInvestedEl = document.getElementById('total-invested');
    const totalValueEl = document.getElementById('total-value');
    const totalPLEl = document.getElementById('total-pl');
    if (totalInvestedEl && totalValueEl && totalPLEl) {
        totalInvestedEl.textContent = `Total Invested: $${totalInvested}`;
        totalValueEl.textContent = `Total Value: $${totalValue}`;
        totalPLEl.textContent = `Total P/L: $${totalPL}`;
        const plValue = parseFloat(totalPL);
        totalInvestedEl.style.backgroundColor = '#2a2a2a';
        totalValueEl.style.backgroundColor = plValue !== 0 ? (plValue > 0 ? 'rgb(76, 145, 76)' : 'rgb(126, 33, 33)') : '#2a2a2a';
        totalPLEl.style.backgroundColor = plValue !== 0 ? (plValue > 0 ? 'rgb(76, 145, 76)' : 'rgb(126, 33, 33)') : '#2a2a2a';
    } else {
        console.error('Totals elements not found');
    }
}

function showCaseSelector() {
    const modal = document.getElementById('case-selector');
    const casesList = document.getElementById('cases-list');
    if (modal && casesList && window.caseNames) {
        casesList.innerHTML = '';
        window.caseNames.forEach(caseName => {
            const isAdded = window.investments.some(inv => inv.item_name === caseName);
            const caseItem = document.createElement('div');
            caseItem.className = `case-item ${isAdded ? 'disabled' : ''}`;
            caseItem.innerHTML = `
                <img src="/static/images/${caseName.toLowerCase().replace(/ /g, '_')}.webp" alt="${caseName}" class="case-image" onerror="this.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='">
                <div class="case-info">
                    <span>${caseName}</span>
                    <div class="release-date">${window.releaseDates[caseName] || 'N/A'}</div>
                </div>
                ${!isAdded ? `
                    <div class="input-group">
                        <div class="input-row">
                            <span>Qty:</span>
                            <input type="number" min="1" value="1" class="case-qty">
                        </div>
                        <div class="input-row">
                            <span>Price:</span>
                            <input type="number" step="0.01" min="0" value="0.00" class="case-price">
                        </div>
                    </div>
                    <button onclick="addCaseWithDetails(event, '${caseName}')">Add</button>
                ` : ''}
            `;
            casesList.appendChild(caseItem);
        });
        modal.style.display = 'block';
    } else {
        console.error('Modal, cases list, or caseNames not found');
    }
}

function addCaseWithDetails(event, caseName) {
    const caseItem = event.target.closest('.case-item');
    const qtyInput = caseItem.querySelector('.case-qty');
    const priceInput = caseItem.querySelector('.case-price');
    const qty = parseInt(qtyInput.value);
    const price = parseFloat(priceInput.value);

    if (isNaN(qty) || qty < 1 || isNaN(price) || price < 0) {
        alert('Please enter valid quantity and price.');
        return;
    }

    fetch('/add_case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `case=${encodeURIComponent(caseName)}&qty=${qty}&price=${price}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            window.investments = data.investments || window.investments;
            loadInvestments();
            hideCaseSelector();
        }
    })
    .catch(error => console.error('Error adding case:', error));
}

function showTransactionModal(index, type) {
    const modal = document.createElement('div');
    modal.className = 'modal transaction-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.parentElement.parentElement.remove()">×</span>
            <h2>${type === 'buy' ? 'Buy Cases' : 'Sell Cases'}</h2>
            <div class="input-group">
                <span>Qty:</span>
                <input type="number" min="1" value="1" class="transaction-qty">
                <span>Price:</span>
                <input type="number" step="0.01" min="0" value="0.00" class="transaction-price">
            </div>
            <button onclick="submitTransaction(${index}, '${type}')">Submit</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function submitTransaction(index, type) {
    const modal = document.querySelector('.transaction-modal');
    const qtyInput = modal.querySelector('.transaction-qty');
    const priceInput = modal.querySelector('.transaction-price');
    const qty = parseInt(qtyInput.value);
    const price = parseFloat(priceInput.value);

    if (isNaN(qty) || qty < 1 || isNaN(price) || price < 0 || (type === 'sell' && qty > window.investments[index].quantity)) {
        alert('Please enter valid quantity and price, and ensure you don\'t sell more than you own.');
        return;
    }

    fetch('/add_transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, type, quantity: qty, price })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            window.investments = data.investments || window.investments;
            loadInvestments();
            modal.remove();
        }
    })
    .catch(error => console.error('Error adding transaction:', error));
}

function hideCaseSelector() {
    const modal = document.getElementById('case-selector');
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.error('Modal not found');
    }
}

let removeIndex = null;

function showConfirmRemoveModal(index) {
    removeIndex = index;
    const modal = document.getElementById('confirm-remove-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function hideConfirmRemoveModal() {
    removeIndex = null;
    const modal = document.getElementById('confirm-remove-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function confirmRemoveCase() {
    if (removeIndex !== null) {
        fetch('/remove_case', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `index=${removeIndex}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                window.investments = data.investments || window.investments;
                loadInvestments();
                hideConfirmRemoveModal();
            }
        })
        .catch(error => console.error('Error removing card:', error));
    }
}

function removeCard(index) {
    showConfirmRemoveModal(index);
}

function updateInvestment(index, field, value) {
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || (field === 'quantity' && parsedValue < 1) || (field === 'purchase_price' && parsedValue < 0)) {
        console.error('Invalid input value:', value);
        return;
    }

    fetch('/update_investment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, field, value: parsedValue })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            window.investments = data.investments || window.investments;
            loadInvestments();
        }
    })
    .catch(error => console.error('Error updating investment:', error));
}

function refreshPrices() {
    fetch('/refresh_prices', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            window.investments = data.investments || window.investments;
            loadInvestments();

            if (data.all_prices) {
                renderPriceStrip(data.all_prices, window.investments);
            }
        } else {
            alert(data.message);
        }
    })
    .catch(error => console.error('Error refreshing prices:', error));
}

function reorderInvestments(fromIndex, toIndex) {
    const movedItem = window.investments.splice(fromIndex, 1)[0];
    window.investments.splice(toIndex, 0, movedItem);
    fetch('/reorder_investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investments: window.investments })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            window.investments = data.investments || window.investments;
            loadInvestments();
        }
    })
    .catch(error => console.error('Error reordering investments:', error));
}

function renderPriceStrip(allPrices, investments = []) {
    const container = document.getElementById('live-price-strip');
    if (!container) {
        console.error("live-price-strip container not found in DOM.");
        return;
    }

    container.innerHTML = '';

    window.caseNames.forEach(name => {
        const price = allPrices?.[name] ?? 0;
        const el = document.createElement('div');
        el.className = 'price-card';
        el.innerHTML = `
            <div class="price-card-title">${name}</div>
            <img class="price-card-image" src="/static/images/${name.toLowerCase().replace(/ /g, '_')}.webp" alt="${name}" onerror="this.src='fallback.png'">
            <div class="price-card-value"><b>$${(price).toFixed(2)}</b></div>
        `;
        container.appendChild(el);
    });

    container.scrollLeft = 5;

    let scrollDirection = 1;
    let isHovered = false;

    container.addEventListener('mouseenter', () => isHovered = true);
    container.addEventListener('mouseleave', () => isHovered = false);

    function autoScroll() {
        const maxScroll = container.scrollWidth - container.clientWidth;

        if (!isHovered) {
            container.scrollLeft += scrollDirection;

            if (container.scrollLeft >= maxScroll) {
                scrollDirection = -1;
                console.warn("⏩ Right edge hit");
            } else if (container.scrollLeft <= 0) {
                scrollDirection = 1;
                console.warn("⏪ Left edge hit");
            }
        }

        setTimeout(autoScroll, 10);
    }

    setTimeout(autoScroll, 50);
}
