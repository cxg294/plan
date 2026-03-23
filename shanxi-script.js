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
