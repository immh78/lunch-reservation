// main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';
import { createPinia } from 'pinia';
import persistedState from 'pinia-plugin-persistedstate'; 

const vuetify = createVuetify({ components, directives });
const pinia = createPinia();
pinia.use(persistedState); 

const app = createApp(App);
app.use(vuetify).use(router).use(pinia);

// ✅ mount만 책임
app.mount('#app');
