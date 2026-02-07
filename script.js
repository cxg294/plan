document.addEventListener('DOMContentLoaded', () => {
    const { meta, inventory, itinerary } = window.travelData;

    // Elements
    const timelineEl = document.getElementById('timeline');
    const expensesEl = document.getElementById('cost-breakdown'); // Fixed ID
    const totalCostEl = document.getElementById('total-price');   // Fixed ID
    const planDescEl = document.getElementById('plan-desc');
    let dayNavEl = document.getElementById('day-nav');

    // Create Day Nav if not exists
    if (!dayNavEl) {
        const div = document.createElement('div');
        div.id = 'day-nav';
        div.className = 'day-nav-container';
        if (timelineEl && timelineEl.parentNode) {
            timelineEl.parentNode.insertBefore(div, timelineEl);
        }
        dayNavEl = div;
    }

    // State
    let currentDayIndex = 0;
    const selections = {}; // Map: `${dayIndex}-${itemIndex}` -> optionId
    let mapInstance = null; // AMap map instance

    // Set Plan Description
    if (planDescEl) planDescEl.textContent = meta.title;

    // ------------------------------------------------------------------
    // HELPER: Resolve ID
    // ------------------------------------------------------------------
    function resolve(id, typeHint) {
        if (!id) return null;
        if (typeHint && inventory[typeHint] && inventory[typeHint][id]) {
            return inventory[typeHint][id];
        }
        for (const cat in inventory) {
            if (inventory[cat][id]) return inventory[cat][id];
        }
        return null;
    }

    function getAmapLink(entity) {
        if (entity && entity.coords) {
            // data.js is GCJ02 standard capable for AMap URI (default)
            return `https://uri.amap.com/marker?position=${entity.coords.join(',')}&name=${encodeURIComponent(entity.name)}`;
        }
        return '#';
    }

    // ------------------------------------------------------------------
    // RENDER: Day Navigation (Tabs)
    // ------------------------------------------------------------------
    function renderDayNav() {
        dayNavEl.innerHTML = itinerary.map((day, index) => {
            const isActive = index === currentDayIndex;
            return `
            <button class="day-nav-btn ${isActive ? 'active' : ''}" data-index="${index}">
                <div class="nav-day-num">Day ${day.day}</div>
                <div class="nav-day-loc">${day.loc}</div>
            </button>
            `;
        }).join('');

        dayNavEl.querySelectorAll('.day-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                if (target) {
                    currentDayIndex = parseInt(target.dataset.index);
                    renderDayNav();
                    renderTimeline();
                }
            });
        });
    }

    // ------------------------------------------------------------------
    // RENDER: Route Overview (Interactive Map)
    // ------------------------------------------------------------------
    function renderRoute(day, stay) {
        const routeEl = document.getElementById('day-route');
        if (!routeEl) return;

        // 1. Collect Points
        let points = [];

        // --- Start Point Logic ---
        let startPoint = null;

        if (currentDayIndex === 0) {
            // Check first schedule item for location
            const firstItem = day.schedule[0];
            let firstEntity = resolve(firstItem.refId);
            if (firstEntity && (firstEntity.coords || firstEntity.locationId)) {
                if (firstEntity.coords) startPoint = { name: firstEntity.name, coords: firstEntity.coords, type: 'start' };
                else {
                    const loc = resolve(firstEntity.locationId, 'locations');
                    if (loc && loc.coords) startPoint = { name: loc.name, coords: loc.coords, type: 'start' };
                }
            }
        } else {
            // Previous stay
            if (currentDayIndex > 0) {
                const prevDay = itinerary[currentDayIndex - 1];
                const prevStay = resolve(prevDay.stay, 'locations');
                if (prevStay && prevStay.coords) {
                    startPoint = { name: prevStay.name + " (出发)", coords: prevStay.coords, type: 'start' };
                }
            }
        }

        if (startPoint) points.push(startPoint);

        // --- Middle Points (Schedule) ---
        day.schedule.forEach((item, idx) => {
            let entityId = item.refId;
            if (item.isChoice) {
                const key = `${currentDayIndex}-${idx}`;
                entityId = selections[key] || item.default;
            }
            let entity = resolve(entityId);

            // Resolve Location
            let loc = null;
            if (entity) {
                if (entity.coords) loc = entity;
                else if (entity.locationId) loc = resolve(entity.locationId, 'locations');
            }

            if (loc && loc.coords) {
                // Avoid duplicate consecutive points
                const last = points[points.length - 1];
                if (!last || last.name !== loc.name) {
                    points.push({ name: loc.name, coords: loc.coords, type: 'via', desc: item.title });
                }
            }
        });

        // --- End Point Logic ---
        const lastPoint = points[points.length - 1];
        if (stay && stay.coords) {
            if (!lastPoint || lastPoint.name !== stay.name) {
                if (day.loc.includes('返程') || day.loc.includes('送机')) {
                    // logic for departure day
                } else {
                    points.push({ name: stay.name + " (下榻)", coords: stay.coords, type: 'end' });
                }
            }
        }

        // Render Container
        routeEl.innerHTML = `
            <div class="route-card glass fade-in">
                <div class="route-header">
                    <h4><i class="fa-solid fa-map-location-dot"></i> 当日路线导航</h4>
                </div>
                <div id="map-container"></div>
                ${points.length > 1 ? `
                <div class="route-meta">
                    <span><i class="fa-solid fa-flag"></i> 全程 ${points.length} 站</span>
                    <span><i class="fa-solid fa-car"></i> 建议自驾/包车</span>
                </div>` : ''}
            </div>
        `;

        // Initialize AMap
        setTimeout(() => {
            // Cleanup previous instance
            if (mapInstance && mapInstance.destroy) {
                mapInstance.destroy();
            } else if (mapInstance && mapInstance.remove) {
                mapInstance.remove(); // Safety
            }
            mapInstance = null;

            const mapContainer = document.getElementById('map-container');
            if (!mapContainer) return;

            // Check AMap Library
            if (typeof AMap === 'undefined') {
                mapContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">地图正在加载...</div>';
                return;
            }

            // Create AMap Instance (GCJ02 default)
            const map = new AMap.Map('map-container', {
                center: [110.3, 18.8],
                zoom: 9,
                viewMode: '2D',
                // mapStyle: 'amap://styles/macaron', // Removed custom style to avoid loading issues
                lang: 'zh_cn'
            });
            mapInstance = map;

            if (points.length === 0) return;

            // Prepare LngLat Objects (Directly from GCJ02 data)
            const waypoints = points.map(p => {
                return {
                    lnglat: new AMap.LngLat(p.coords[0], p.coords[1]),
                    name: p.name,
                    type: p.type,
                    desc: p.desc
                };
            });

            // Add Custom Markers
            waypoints.forEach((wp, i) => {
                let iconColor = '#2A9D8F'; // Primary
                if (wp.type === 'start') iconColor = '#2A9D8F';
                if (wp.type === 'end') iconColor = '#F4A261'; // Accent
                if (wp.type === 'via') iconColor = '#264653';

                let innerIndexHtml = '';
                if (wp.type === 'via') innerIndexHtml = `<span style="color:white; font-size:10px; line-height:12px; display:block; text-align:center; margin-top: 1px;">${i}</span>`;

                const iconHtml = `<div style="
                    background: ${iconColor};
                    width: ${wp.type === 'via' ? 16 : 14}px; height: ${wp.type === 'via' ? 16 : 14}px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                ">${innerIndexHtml}</div>`;

                const marker = new AMap.Marker({
                    position: wp.lnglat,
                    content: iconHtml,
                    anchor: 'center',
                    offset: new AMap.Pixel(0, 0),
                    map: map,
                    zIndex: 100 // Ensure markers are above route line
                });

                // Info Window
                const infoContent = `<div class="popup-content" style="padding:5px;min-width:150px;">
                                        <div class="popup-title" style="font-weight:bold;margin-bottom:4px;font-size:14px;">${wp.name}</div>
                                        ${wp.desc ? `<div class="popup-type" style="font-size:12px;color:#666;">${wp.desc}</div>` : ''}
                                     </div>`;

                marker.on('click', () => {
                    const infoWindow = new AMap.InfoWindow({
                        content: infoContent,
                        offset: new AMap.Pixel(0, -10)
                    });
                    infoWindow.open(map, wp.lnglat);
                });
            });

            // Calculate Driving Route
            if (waypoints.length > 1) {
                const start = waypoints[0].lnglat;
                const end = waypoints[waypoints.length - 1].lnglat;
                const vias = waypoints.slice(1, -1).map(wp => wp.lnglat);

                // Initialize Driving Plugin
                // hideMarkers: true to hide default start/end/via markers so we can show our custom ones
                const driving = new AMap.Driving({
                    map: map,
                    hideMarkers: true,
                    showTraffic: false,
                    autoFitView: true
                });

                driving.search(start, end, { waypoints: vias }, function (status, result) {
                    if (status !== 'complete') {
                        // If route fails, fallback to view fitting points
                        map.setFitView();
                    }
                });
            } else if (waypoints.length === 1) {
                map.setCenter(waypoints[0].lnglat);
                map.setZoom(13);
            }

        }, 300);
    }

    // ------------------------------------------------------------------
    // RENDER: Timeline (Single Day View)
    // ------------------------------------------------------------------
    function renderTimeline() {
        const day = itinerary[currentDayIndex];
        const stay = resolve(day.stay, 'locations');

        renderRoute(day, stay);

        const scheduleHtml = day.schedule.map((item, itemIdx) => {
            // Choice Logic
            let entityId = item.refId;
            let choiceHtml = '';

            if (item.isChoice) {
                const selectionKey = `${currentDayIndex}-${itemIdx}`;
                // Default if not selected yet
                if (!selections[selectionKey]) {
                    selections[selectionKey] = item.default;
                }
                entityId = selections[selectionKey];

                // Render Toggle Buttons
                const optionsHtml = item.options.map(optId => {
                    const opt = resolve(optId);
                    const isSelected = (optId === entityId);
                    return `<button class="choice-btn ${isSelected ? 'active' : ''}" 
                                   data-key="${selectionKey}" 
                                   data-val="${optId}">${opt.name}</button>`;
                }).join('');

                choiceHtml = `<div class="choice-container">${optionsHtml}</div>`;
            }

            let entity = resolve(entityId);

            // Handle entity resolution failure
            if (!entity) entity = { name: item.title || 'Unknown', desc: item.desc || '' };

            // Navigation
            let navBtn = '';
            let locationEntity = null;
            if (entity) {
                if (entity.locationId) locationEntity = resolve(entity.locationId, 'locations');
                else if (entity.coords) locationEntity = entity;
            }
            if (locationEntity && locationEntity.coords) {
                navBtn = `<a href="${getAmapLink(locationEntity)}" target="_blank" class="nav-link"><i class="fa-solid fa-location-arrow"></i> 导航</a>`;
            }

            const title = item.title || entity.name;
            const desc = item.desc || (entity.desc || entity.type || '');
            const priceTag = (entity.price !== undefined) ? `<span class="price-tag">¥${entity.price}</span>` : '';
            const imgHtml = (entity.img) ? `<div class="card-image" style="background-image: url('${entity.img}')"></div>` : '';

            // Details
            let detailsHtml = '';
            if (entity.packageInfo && Array.isArray(entity.packageInfo)) {
                detailsHtml += `<div class="detail-section package-section"><h4><i class="fa-solid fa-gift"></i> 包含</h4><ul>${entity.packageInfo.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
            }
            if (entity.precautions && Array.isArray(entity.precautions)) {
                detailsHtml += `<div class="detail-section warn-section"><h4><i class="fa-solid fa-circle-exclamation"></i> 注意</h4><ul>${entity.precautions.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
            }
            if (entity.tips && typeof entity.tips === 'string') {
                detailsHtml += `<div class="detail-section tip-section"><i class="fa-solid fa-lightbulb"></i> ${entity.tips}</div>`;
            }

            return `
                <div class="schedule-card fade-in-up">
                    <div class="time-column">
                        <span class="time-text">${item.time}</span>
                        <div class="time-dots"></div>
                    </div>
                    <div class="card-content-wrapper">
                        ${imgHtml}
                        <div class="card-content">
                            ${choiceHtml}
                            <div class="card-header">
                                <h3 class="card-title">${title}</h3>
                                <div class="card-actions">
                                    ${priceTag}
                                    ${navBtn}
                                </div>
                            </div>
                            <p class="card-desc">${desc}</p>
                            ${detailsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const prepHtml = day.preparation ? day.preparation.map(pid => {
            const p = resolve(pid, 'items');
            return p ? `<div class="prep-badge" title="${p.note}"><i class="fa-solid ${p.icon}"></i> ${p.name}</div>` : '';
        }).join('') : '';

        timelineEl.innerHTML = `
        <div class="single-day-view">
            <div class="day-header-hero">
                <div class="day-title-row">
                    <h2>${day.date}</h2>
                    <span class="weather-pill">${day.weather || ''}</span>
                </div>
                ${stay ? `<div class="stay-pill"><i class="fa-solid fa-bed"></i> <strong>下榻:</strong> ${stay.name} <a href="${getAmapLink(stay)}" target="_blank" class="stay-link"><i class="fa-solid fa-arrow-up-right-from-square"></i></a></div>` : ''}
                ${prepHtml ? `<div class="prep-container"><span class="prep-label">今日准备:</span> ${prepHtml}</div>` : ''}
            </div>
            <div class="schedule-list">${scheduleHtml}</div>
        </div>
        `;

        // Attach Listeners for Choice Buttons
        timelineEl.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                const val = e.target.dataset.val;
                selections[key] = val; // Update state
                renderTimeline(); // Re-render
                calculateCost(); // Re-calc cost
            });
        });
    }

    // ------------------------------------------------------------------
    // RENDER: Costs
    // ------------------------------------------------------------------
    function calculateCost() {
        let hotelCost = 11200;
        let diningCost = 0;
        let activityCost = 0;
        const flightCost = 5500;
        const transportCost = meta.baseSettings.transportBudget;

        itinerary.forEach((day, dIdx) => {
            day.schedule.forEach((item, iIdx) => {
                let entity = null;
                if (item.isChoice) {
                    const key = `${dIdx}-${iIdx}`;
                    const selectedId = selections[key] || item.default;
                    entity = resolve(selectedId);
                } else {
                    entity = resolve(item.refId);
                }

                if (entity && entity.price) {
                    if (item.type === 'dining' || entity.type?.includes('餐') || entity.type?.includes('火锅') || entity.type?.includes('轻食')) diningCost += entity.price * meta.travelers;
                    else if (item.type === 'activity' || entity.price > 0) activityCost += entity.price * meta.travelers;
                }
            });
        });

        if (expensesEl) {
            expensesEl.innerHTML = `
                <div class="cost-row"><span><i class="fa-solid fa-plane"></i> 机票 (预估)</span><span>¥${flightCost}</span></div>
                <div class="cost-row"><span><i class="fa-solid fa-hotel"></i> 酒店 (5晚)</span><span>¥${hotelCost}</span></div>
                <div class="cost-row"><span><i class="fa-solid fa-utensils"></i> 餐饮 (点单)</span><span>¥${diningCost}</span></div>
                <div class="cost-row"><span><i class="fa-solid fa-ticket"></i> 活动 & 门票</span><span>¥${activityCost}</span></div>
                <div class="cost-row"><span><i class="fa-solid fa-car"></i> 交通预留</span><span>¥${transportCost}</span></div>
                <div class="total-row"><span>总计 (2人)</span><span>¥${(flightCost + hotelCost + diningCost + activityCost + transportCost).toLocaleString()}</span></div>
            `;
        }

        if (totalCostEl) {
            const total = flightCost + hotelCost + diningCost + activityCost + transportCost;
            totalCostEl.textContent = `¥${total.toLocaleString()}`;
        }
    }

    // ------------------------------------------------------------------
    // RENDER: Food Collection (New)
    // ------------------------------------------------------------------
    function renderFoodCollection() {
        const grid = document.getElementById('food-grid');
        const btns = document.querySelectorAll('.filter-btn');
        if (!grid) return;

        // Flatten dining items with inferred city
        const foodItems = Object.entries(inventory.dining).map(([key, item]) => {
            let city = '万宁'; // Default
            // Infer City from Location.address or default
            const loc = resolve(item.locationId);
            if (loc && loc.address) {
                if (loc.address.includes('三亚') || loc.address.includes('海棠')) city = '三亚';
            }
            return { ...item, id: key, city };
        });

        // Render Function
        const render = (filter) => {
            grid.innerHTML = foodItems
                .filter(item => filter === 'all' || item.city === filter)
                .map(item => {
                    const loc = resolve(item.locationId);
                    const cityBadge = item.city === '三亚' ?
                        `<span class="city-badge" style="background:var(--accent)">三亚</span>` :
                        `<span class="city-badge">万宁</span>`;

                    return `
                    <div class="food-card fade-in-up" onclick="window.open('${getAmapLink(loc)}', '_blank')">
                        <div class="food-img" style="background-image: url('${item.img || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}')">
                            <span class="food-tag">${item.type}</span>
                        </div>
                        <div class="food-info">
                            <div class="food-title">
                                <span>${cityBadge}${item.name}</span>
                                <span class="price-tag">¥${item.price}/人</span>
                            </div>
                            <div class="food-meta">
                                <span><i class="fa-solid fa-location-dot"></i> ${loc ? loc.name : '未知地点'}</span>
                            </div>
                            ${item.tips ? `<div class="food-tips"><i class="fa-solid fa-thumbs-up"></i> ${item.tips}</div>` : ''}
                        </div>
                    </div>
                    `;
                }).join('');
        };

        // Init
        render('all');

        // Events
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                render(btn.dataset.filter);
            });
        });
    }

    renderDayNav();
    renderTimeline();
    calculateCost();
    renderFoodCollection();
});
