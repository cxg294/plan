// 山西攻略页面交互脚本

document.addEventListener('DOMContentLoaded', () => {
    // 导航高亮
    initNavHighlight();
    // Checklist 持久化
    initChecklist();
    // 滚动动画
    initScrollAnimations();
});

/** 导航高亮：滚动时高亮当前区域的导航按钮 */
function initNavHighlight() {
    const navPills = document.querySelectorAll('.nav-pill');
    const sections = [];

    navPills.forEach(pill => {
        const href = pill.getAttribute('href');
        if (href && href.startsWith('#')) {
            const section = document.querySelector(href);
            if (section) sections.push({ el: section, pill, id: href.slice(1) });
        }
    });

    function updateNav() {
        let current = '';
        const scrollY = window.scrollY + 100;

        for (const s of sections) {
            if (s.el.offsetTop <= scrollY) {
                current = s.id;
            }
        }

        navPills.forEach(p => p.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-pill[href="#${current}"]`);
        if (activeLink) activeLink.classList.add('active');
    }

    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();
}

/** Checklist 持久化到 localStorage */
function initChecklist() {
    const KEY = 'shanxi-trip-checklist';
    const checkboxes = document.querySelectorAll('.check-item input[type="checkbox"]');
    
    // 恢复状态
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    checkboxes.forEach((cb, i) => {
        if (saved[i]) cb.checked = true;
    });

    // 保存状态
    checkboxes.forEach((cb, i) => {
        cb.addEventListener('change', () => {
            const state = {};
            checkboxes.forEach((c, j) => {
                if (c.checked) state[j] = true;
            });
            localStorage.setItem(KEY, JSON.stringify(state));
        });
    });
}

/** 滚动动画：时间线卡片进入视口时的渐入效果 */
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateX(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    // 给所有日期区域的时间线项添加初始隐藏状态
    document.querySelectorAll('#day2 .tl-item, #day3 .tl-item').forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(20px)';
        item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(item);
    });

    // 美食卡片动画
    document.querySelectorAll('.food-item').forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(15px)';
        item.style.transition = `opacity 0.4s ease ${i * 0.05}s, transform 0.4s ease ${i * 0.05}s`;
        observer.observe(item);
    });

    // Checklist组动画
    document.querySelectorAll('.checklist-group').forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(15px)';
        item.style.transition = `opacity 0.4s ease ${i * 0.08}s, transform 0.4s ease ${i * 0.08}s`;
        observer.observe(item);
    });
}

// ============================
// 方案 A/B 切换
// ============================
let currentPlan = 'a';

/** 切换到指定方案 */
function switchPlan(plan) {
    if (plan === currentPlan) return;
    currentPlan = plan;

    const planA = document.getElementById('planA');
    const planB = document.getElementById('planB');
    const planSwitch = document.getElementById('planSwitch');
    const planDesc = document.getElementById('planDesc');
    const labels = document.querySelectorAll('.plan-toggle-label');

    if (plan === 'a') {
        planA.classList.remove('hidden');
        planB.classList.add('hidden');
        planSwitch.classList.remove('plan-b');
        planDesc.textContent = '方案A：太原博物院+晋祠+平遥 · 太原住1晚';
    } else {
        planA.classList.add('hidden');
        planB.classList.remove('hidden');
        planSwitch.classList.add('plan-b');
        planDesc.textContent = '方案B：晋祠+平遥+乔家大院 · 平遥住2晚 · 零绕路';
    }

    // 更新label高亮
    labels.forEach(l => {
        l.classList.toggle('active', l.dataset.plan === plan);
    });

    // 更新Hero区域的统计数据
    updateHeroStats(plan);

    // 滚动到顶部
    document.getElementById('planToggle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** 切换方案（toggle按钮） */
function togglePlan() {
    switchPlan(currentPlan === 'a' ? 'b' : 'a');
}

/** 更新Hero区的统计数据 */
function updateHeroStats(plan) {
    const stats = document.querySelectorAll('.hero-stats .stat span');
    if (plan === 'a') {
        // 方案A: 里程1174km, 人均¥1,482
        if (stats[2]) stats[2].textContent = '1,174km';
        if (stats[3]) stats[3].textContent = '人均¥1,482';
    } else {
        // 方案B: 里程~1100km, 人均¥1,554
        if (stats[2]) stats[2].textContent = '~1,100km';
        if (stats[3]) stats[3].textContent = '人均¥1,554';
    }
}
