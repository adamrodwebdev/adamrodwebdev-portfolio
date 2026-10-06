import { reactive, ref, computed, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { config } from '../config.js';
import { burst } from '../fx/particles.js';

const MAX = 1500;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default {
  name: 'ContactForm',
  setup() {
    const { t, tm, rt } = useI18n();
    const list = (key) => (tm(key) || []).map((m) => rt(m));
    const types = list('form.types');
    const budgets = list('form.budgets');
    const stepLabels = list('form.steps');
    const blank = () => ({ nom: '', email: '', entreprise: '', type: types[0], budget: budgets[1], message: '', rgpd: false, bot: '' });
    const form = reactive(blank());
    const touched = reactive({});
    const state = ref('idle');       // idle | sending | sent | error
    const step = ref(0);             // progression de l'envoi (0 → 3)
    const formEl = ref(null);
    const canvas = ref(null);
    const successTitle = ref(null);
    const shaking = ref(false);
    const errorMsg = ref('');
    const ticket = ref('');
    let stopBurst = null;

    const errors = computed(() => {
      const e = {};
      if (form.nom.trim().length < 2) e.nom = t('form.errors.name');
      if (!emailRe.test(form.email.trim())) e.email = t('form.errors.email', { at: '@' });
      if (form.message.trim().length < 20) e.message = t('form.errors.message');
      if (form.message.length > MAX) e.message = t('form.errors.tooLong', { max: MAX });
      if (!form.rgpd) e.rgpd = t('form.errors.consent');
      return e;
    });
    const show = (k) => touched[k] && errors.value[k];

    const encode = (data) => Object.keys(data).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k])).join('&');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    async function send() {
      const payload = { nom: form.nom, email: form.email, entreprise: form.entreprise, type: form.type, budget: form.budget, message: form.message };
      if (config.formMode === 'demo') { await wait(600); return { demo: true }; }
      if (config.formMode === 'endpoint' && config.formEndpoint) {
        const r = await fetch(config.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return {};
      }
      // Netlify Forms
      const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: encode({ 'form-name': 'contact', 'bot-field': form.bot, ...payload }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return {};
    }

    const demo = ref(false);
    async function submit() {
      ['nom', 'email', 'message', 'rgpd'].forEach((k) => (touched[k] = true));
      errorMsg.value = '';
      if (Object.keys(errors.value).length) {
        shaking.value = false; await nextTick(); shaking.value = true;
        const first = formEl.value.querySelector('.has-error input, .has-error textarea');
        first?.focus();
        return;
      }
      if (form.bot) return; // robot détecté
      state.value = 'sending'; step.value = 1;
      try {
        const [res] = await Promise.all([send(), wait(900).then(() => { step.value = 2; })]);
        await wait(700); step.value = 3; await wait(450);
        demo.value = !!res.demo;
        ticket.value = 'ARW-' + Date.now().toString(36).toUpperCase().slice(-6);
        state.value = 'sent';
        await nextTick();
        successTitle.value?.focus();
        stopBurst = burst(canvas.value);
      } catch (err) {
        state.value = 'error'; step.value = 0;
        errorMsg.value = t('form.errors.send', { email: config.contactEmail });
        shaking.value = false; await nextTick(); shaking.value = true;
      }
    }

    function reset() {
      stopBurst?.();
      Object.assign(form, blank());
      Object.keys(touched).forEach((k) => delete touched[k]);
      state.value = 'idle'; step.value = 0;
      nextTick(() => formEl.value?.querySelector('input')?.focus());
    }
    onBeforeUnmount(() => stopBurst?.());

    return { form, touched, errors, show, state, step, stepLabels, submit, reset, formEl, canvas, successTitle, shaking, errorMsg, ticket, demo, types, budgets, MAX, email: config.contactEmail, t };
  },
  template: `
  <Transition name="swap" mode="out-in">
    <form v-if="state !== 'sent'" key="form" ref="formEl" class="cform" :class="{ shake: shaking }" novalidate
          name="contact" @submit.prevent="submit" @animationend="shaking = false" :aria-busy="state === 'sending' ? 'true' : 'false'">
      <p class="visually-hidden"><label for="f-bot">{{ t('form.bot') }}</label><input id="f-bot" v-model="form.bot" tabindex="-1" autocomplete="off"></p>

      <div class="field" :class="{ 'has-error': show('nom') }">
        <label for="f-nom">{{ t('form.name') }}</label>
        <input id="f-nom" v-model="form.nom" autocomplete="name" required @blur="touched.nom = true"
               :aria-invalid="show('nom') ? 'true' : 'false'" aria-describedby="e-nom">
        <span class="field__bar" aria-hidden="true"></span>
        <Transition name="err"><p v-if="show('nom')" id="e-nom" class="field__error">{{ errors.nom }}</p></Transition>
      </div>

      <div class="field" :class="{ 'has-error': show('email') }">
        <label for="f-email">{{ t('form.email') }}</label>
        <input id="f-email" v-model="form.email" type="email" inputmode="email" autocomplete="email" required @blur="touched.email = true"
               :aria-invalid="show('email') ? 'true' : 'false'" aria-describedby="e-email">
        <span class="field__bar" aria-hidden="true"></span>
        <Transition name="err"><p v-if="show('email')" id="e-email" class="field__error">{{ errors.email }}</p></Transition>
      </div>

      <div class="field">
        <label for="f-entreprise">{{ t('form.company') }} <small>{{ t('form.optional') }}</small></label>
        <input id="f-entreprise" v-model="form.entreprise" autocomplete="organization">
        <span class="field__bar" aria-hidden="true"></span>
      </div>

      <div class="field">
        <label for="f-type">{{ t('form.type') }}</label>
        <select id="f-type" v-model="form.type"><option v-for="t in types" :key="t">{{ t }}</option></select>
        <span class="field__bar" aria-hidden="true"></span>
      </div>

      <fieldset class="chips field--full">
        <legend class="field__label">{{ t('form.budget') }}</legend>
        <label v-for="(b, i) in budgets" :key="b" class="chip">
          <input type="radio" name="budget" :id="'f-budget-' + i" :value="b" v-model="form.budget"><span>{{ b }}</span>
        </label>
      </fieldset>

      <div class="field" :class="{ 'has-error': show('message') }">
        <label for="f-message">{{ t('form.message') }}</label>
        <span class="field__count" aria-hidden="true">{{ form.message.length }} / {{ MAX }}</span>
        <textarea id="f-message" v-model="form.message" rows="6" required :maxlength="MAX + 50" @blur="touched.message = true"
          :placeholder="t('form.placeholder')"
          :aria-invalid="show('message') ? 'true' : 'false'" aria-describedby="e-message"></textarea>
        <span class="field__bar" aria-hidden="true"></span>
        <Transition name="err"><p v-if="show('message')" id="e-message" class="field__error">{{ errors.message }}</p></Transition>
      </div>

      <div class="field field--check" :class="{ 'has-error': show('rgpd') }">
        <input id="f-rgpd" class="check" type="checkbox" v-model="form.rgpd" @change="touched.rgpd = true" :aria-invalid="show('rgpd') ? 'true' : 'false'" aria-describedby="e-rgpd">
        <div>
          <label for="f-rgpd">{{ t('form.consent') }}</label>
          <Transition name="err"><p v-if="show('rgpd')" id="e-rgpd" class="field__error">{{ errors.rgpd }}</p></Transition>
        </div>
      </div>

      <Transition name="err"><p v-if="errorMsg" class="cform__alert" role="alert">{{ errorMsg }}</p></Transition>

      <div class="cform__actions">
        <button class="btn btn--gold submit-btn magnetic" type="submit" :disabled="state === 'sending'" :style="{ '--p': step / 3 }">
          <span aria-live="polite">{{ stepLabels[step] }}</span>
          <i class="submit-btn__progress" aria-hidden="true"></i>
        </button>
        <p class="cform__note">{{ t('form.note') }}</p>
      </div>
    </form>

    <div v-else key="ok" class="success" role="status">
      <canvas ref="canvas" class="success__canvas" aria-hidden="true"></canvas>
      <svg class="success__emblem" viewBox="0 0 150 150" aria-hidden="true">
        <path class="success__ping" d="M75 12 129.6 43.5v63L75 138 20.4 106.5v-63Z"/>
        <path class="success__hex" d="M75 12 129.6 43.5v63L75 138 20.4 106.5v-63Z" pathLength="1"/>
        <path class="success__hex2" d="M75 28 115.7 51.5v47L75 122 34.3 98.5v-47Z" pathLength="1"/>
        <path class="success__check" d="M50 77 68 94 101 58" pathLength="1"/>
      </svg>
      <h3 ref="successTitle" class="success__title" tabindex="-1">{{ t('form.success.title') }}</h3>
      <p class="success__text">{{ t('form.success.text', { name: form.nom.split(' ')[0], email: form.email }) }}</p>
      <ol class="success__log">
        <li style="animation-delay:1.5s"><b>[OK]</b> {{ t('form.success.log1') }}</li>
        <li style="animation-delay:1.7s"><b>[OK]</b> {{ t('form.success.log2') }}</li>
        <li style="animation-delay:1.9s"><b>[OK]</b> {{ t('form.success.log3', { ticket }) }}</li>
      </ol>
      <p v-if="demo" class="success__demo">{{ t('form.success.demo') }}</p>
      <button class="btn btn--ghost" type="button" @click="reset"><span>{{ t('form.success.again') }}</span></button>
    </div>
  </Transition>
  `,
};
