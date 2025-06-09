import { createRouter, createWebHashHistory } from 'vue-router';
import Main from '../pages/Main.vue';
import Login from '../pages/Login.vue';
import { isLoggedIn } from '../config/authGuard';

const routes = [
  {
    path: '/',
    name: 'Main',
    component: Main,
    beforeEnter: (to, from, next) => {
      if (!isLoggedIn()) {
        next('/login');
      } else {
        next();
      }
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
];

export default createRouter({
  history: createWebHashHistory('/lunch-reservation/'),
  routes,
});
