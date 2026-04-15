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

    // Load initial data
    if (document.getElementById('total-ingresos')) {
        loadSummary();
        loadRecentRecords();
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
                    
                    loadSummary();
                    loadRecentRecords();
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
        try {
            const response = await fetch('/api/summary', {
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

    async function loadRecentRecords() {
        if (!token) return;
        try {
            const response = await fetch('/api/recent', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401) return;

            if (response.ok) {
                const data = await response.json();
                const container = document.getElementById('records-list');
                container.innerHTML = '';
                
                if (data.registros.length === 0) {
                    container.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 1rem;">No hay registros todavía.</div>';
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
                                loadSummary();
                                loadRecentRecords();
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
            document.getElementById('records-list').innerHTML = '<div class="error">Error cargando registros</div>';
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
