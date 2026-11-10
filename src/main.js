import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });
mount(App, { target: document.getElementById('app') });
