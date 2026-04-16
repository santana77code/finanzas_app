document.addEventListener('DOMContentLoaded', () => {
    // ---- AUTH LOGIC ----
    const token = localStorage.getItem('access_token');
    if (!token) {
        // Redirigir al login si no estamos ya en él
        if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
            return;
        }
    } else {
        // Configurar el botón de Logout si existe
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            });
        }
    }

    // Dynamic category selector logic
    const radioButtons = document.querySelectorAll('input[name="tipo"]');
    const categorySelect = document.getElementById('categoria');
    const optGroups = categorySelect ? categorySelect.querySelectorAll('optgroup') : [];

    function updateCategoryOptions(tipo) {
        if (!categorySelect) return;
        // Reset selection
        categorySelect.value = '';
        
        optGroups.forEach(group => {
            if (group.className === `opt-${tipo.toLowerCase()}`) {
                group.style.display = 'block';
            } else {
                group.style.display = 'none';
            }
        });
    }

    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateCategoryOptions(e.target.value);
        });
    });

    // Format currency
    function formatMoney(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    }

    // Filter Selectors Setup
    const daySelect = document.getElementById('day-select');
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');

    if (monthSelect && yearSelect && daySelect) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // 1-12
        const currentDay = currentDate.getDate();

        // Populate year dropdown (current year - 5 to current year + 5)
        for (let y = currentYear - 5; y <= currentYear + 5; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            yearSelect.appendChild(option);
        }

        // Setup dynamic days
        function updateDays() {
            const y = parseInt(yearSelect.value);
            const m = parseInt(monthSelect.value);
            const daysInMonth = new Date(y, m, 0).getDate();
            
            const prevValue = daySelect.value;
            daySelect.innerHTML = '<option value="0">Mes Completo</option>';
            
            for (let d = 1; d <= daysInMonth; d++) {
                const option = document.createElement('option');
                option.value = d;
                option.textContent = d;
                daySelect.appendChild(option);
            }
            
            if (prevValue > 0 && prevValue <= daysInMonth) {
                daySelect.value = prevValue;
            } else {
                daySelect.value = "0";
            }
        }

        // Set initial values
        monthSelect.value = currentMonth;
        yearSelect.value = currentYear;
        updateDays();
        daySelect.value = "0"; // Default: whole month, users can change to currentDay if they want

        // Auto reload on change
        daySelect.addEventListener('change', reloadData);
        monthSelect.addEventListener('change', () => { updateDays(); reloadData(); });
        yearSelect.addEventListener('change', () => { updateDays(); reloadData(); });
    }

    function reloadData() {
        loadSummary();
        // If modal is open, reload records list
        const modal = document.getElementById('history-modal');
        if (modal && modal.style.display === 'flex') {
            loadMonthRecords();
        }
    }

    // Modal Logic
    const openHistoryBtn = document.getElementById('open-history-btn');
    const closeHistoryBtn = document.getElementById('close-modal-btn');
    const historyModal = document.getElementById('history-modal');

    if (openHistoryBtn && closeHistoryBtn && historyModal) {
        openHistoryBtn.addEventListener('click', () => {
            historyModal.style.display = 'flex';
            loadMonthRecords();
        });

        closeHistoryBtn.addEventListener('click', () => {
            historyModal.style.display = 'none';
        });

        // Close when clicking outside
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) {
                historyModal.style.display = 'none';
            }
        });
    }

    // Load initial data
    if (document.getElementById('total-ingresos')) {
        loadSummary();
    }

    // Form submission
    const form = document.getElementById('record-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            const formData = new FormData(form);
            const data = {
                tipo: formData.get('tipo'),
                monto: parseFloat(formData.get('monto')),
                categoria: formData.get('categoria'),
                descripcion: formData.get('descripcion') || ''
            };

            try {
                const response = await fetch('/api/record', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });

                if (response.status === 401) {
                    localStorage.removeItem('access_token');
                    window.location.href = '/login';
                    return;
                }

                const result = await response.json();

                if (response.ok) {
                    showStatus('¡Registro guardado exitosamente!', 'success');
                    form.reset();
                    document.querySelector('input[value="Ingreso"]').checked = true;
                    updateCategoryOptions('Ingreso');
                    
                    reloadData();
                } else {
                    showStatus(result.detail || 'Error al guardar el registro', 'error');
                }
            } catch (error) {
                showStatus('Error de conexión con el base de datos', 'error');
                console.error(error);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar';
            }
        });
    }

    function showStatus(message, type) {
        const statusDiv = document.getElementById('status-message');
        if (!statusDiv) return;
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        
        setTimeout(() => {
            statusDiv.style.opacity = '0';
            setTimeout(() => {
                statusDiv.className = 'status-message';
                statusDiv.style.opacity = '1';
            }, 300);
        }, 3000);
    }

    async function loadSummary() {
        if (!token) return;
        
        let url = '/api/summary';
        const daySelect = document.getElementById('day-select');
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');
        
        if (monthSelect && yearSelect) {
            url += `?mes=${monthSelect.value}&anio=${yearSelect.value}`;
            if (daySelect && daySelect.value !== "0") {
                url += `&dia=${daySelect.value}`;
            }
        }
        
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (response.ok) {
                const data = await response.json();
                const res = data.resumen;
                
                animateValue('total-ingresos', res.Ingreso);
                animateValue('total-gastos', res.Gasto);
                animateValue('total-ahorros', res.Ahorro);
                animateValue('total-balance', res.Balance_Disponible);
            }
        } catch (error) {
            console.error("Error loading summary:", error);
        }
    }

    async function loadMonthRecords() {
        if (!token) return;
        
        let url = '/api/records_by_month';
        const daySelect = document.getElementById('day-select');
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');
        
        if (monthSelect && yearSelect) {
            url += `?mes=${monthSelect.value}&anio=${yearSelect.value}`;
            if (daySelect && daySelect.value !== "0") {
                url += `&dia=${daySelect.value}`;
            }
            
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) {
                if (daySelect && daySelect.value !== "0") {
                    modalTitle.textContent = `Movimientos del ${daySelect.value} de ${monthNames[monthSelect.value - 1]} ${yearSelect.value}`;
                } else {
                    modalTitle.textContent = `Movimientos de ${monthNames[monthSelect.value - 1]} ${yearSelect.value}`;
                }
            }
        }

        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401) return;

            if (response.ok) {
                const data = await response.json();
                const container = document.getElementById('modal-records-list');
                if(!container) return;
                
                container.innerHTML = '';
                
                if (data.registros.length === 0) {
                    container.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 2rem;">No hay registros para este mes.</div>';
                    return;
                }

                data.registros.forEach(record => {
                    const div = document.createElement('div');
                    div.className = `record-item t-${record.Tipo.toLowerCase()}`;
                    
                    const sign = record.Tipo === 'Gasto' ? '-' : '+';
                    const amountClass = record.Tipo === 'Gasto' ? 'expense' : (record.Tipo === 'Ahorro' ? 'savings' : 'income');
                    
                    const dateObj = new Date(record.Fecha);
                    const dateStr = dateObj.toLocaleDateString();

                    div.innerHTML = `
                        <div class="record-info">
                            <h4>${record.Categoria}</h4>
                            <p>${dateStr} ${record.Descripcion ? '- ' + record.Descripcion : ''}</p>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div class="record-amount ${amountClass}">
                                ${sign}${formatMoney(record.Monto)}
                            </div>
                            <button class="delete-btn" data-id="${record.id}" title="Eliminar registro">🗑️</button>
                        </div>
                    `;
                    container.appendChild(div);
                });
                
                document.querySelectorAll('.delete-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
                        
                        const btnEl = e.currentTarget;
                        const id = btnEl.dataset.id;
                        
                        btnEl.disabled = true;
                        btnEl.style.opacity = '0.3';
                        
                        try {
                            const res = await fetch(`/api/record/${id}`, { 
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            
                            if (res.ok) {
                                showStatus('Registro eliminado correctamente', 'success');
                                reloadData();
                            } else {
                                const errData = await res.json();
                                showStatus(errData.detail || 'Error al eliminar', 'error');
                                btnEl.disabled = false;
                                btnEl.style.opacity = '0.6';
                            }
                        } catch (err) {
                            showStatus('Error de conexión', 'error');
                            btnEl.disabled = false;
                            btnEl.style.opacity = '0.6';
                        }
                    });
                });
            }
        } catch (error) {
            const container = document.getElementById('modal-records-list');
            if (container) container.innerHTML = '<div class="error">Error cargando registros</div>';
        }
    }

    function animateValue(id, end, duration = 1000) {
        const obj = document.getElementById(id);
        if(!obj) return;
        const start = 0;
        let startTimestamp = null;
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const currentVal = start + easeProgress * (end - start);
            
            obj.innerHTML = formatMoney(currentVal);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});
