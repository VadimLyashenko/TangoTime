import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'

async function waitForJapaneseFont() {
    if (!document.fonts) {
        return
    }

    await Promise.race([
        document.fonts.load('400 1em "Sawarabi Mincho"'),
        new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
}

waitForJapaneseFont().finally(() => {
    createApp(App).mount('#app')
})
