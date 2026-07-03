import { createApp } from "vue"
import { createPinia } from "pinia"
import { Chart } from "chart.js"

import App from "./App.vue"
import router from "./router"

import "./assets/main.css"

// Dark theme defaults for all Chart.js instances
Chart.defaults.color = "#e2e8f0"
Chart.defaults.borderColor = "#334155"
Chart.defaults.scale.grid.color = "#334155"

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount("#app")
