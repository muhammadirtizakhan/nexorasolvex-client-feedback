(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const form = $('#feedbackForm');
  const dialog = $('#reviewDialog');
  const files = {clientProfile: null, clientSignature: null};
  const urls = {clientProfile: null, clientSignature: null};
  const uploadVersions = {clientProfile: 0, clientSignature: 0};
  let submittedRecord = null;
  let busy = false;
  let entered = false;
  let validationAttempted = false;
  const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  const labels = {
    clientName:'Full name', clientEmail:'Email address', companyName:'Company / business', projectName:'Project name', clientWebsite:'Company website', servicePlan:'Service plan', serviceCategory:'Service category', deploymentPlatform:'Deployment platform', otherPlatform:'Other platform', deploymentUrl:'Live deployment URL', projectCost:'Project cost', currency:'Currency', deliveryDate:'Delivery date', projectStatus:'Project status', projectNotes:'Additional project notes', overallRating:'Overall experience', designRating:'Design Quality', performanceRating:'Website / System Performance', communicationRating:'Communication & Support', deliveryRating:'Delivery & Project Handling', detailedFeedback:'Detailed feedback', suggestions:'Suggestions or Additional Comments', declarationAccepted:'Declaration accepted', marketingConsent:'Public-use consent', submittedAt:'Submission date / time', temporaryReference:'Reference ID'
  };
  const introMessages = ['Preparing your feedback experience...', 'Preparing your project record...', 'Loading feedback workspace...', 'Your experience is ready.'];
  // Fit the complete introduction to the current visible viewport, including landscape.
  // Only the introduction is fitted; the long form keeps normal document scrolling.
  function fitIntroduction() {
    if (entered) return;
    const card = $('.welcome-card');
    const height = window.visualViewport?.height || window.innerHeight;
    const width = window.visualViewport?.width || window.innerWidth;
    const fit = Math.min(1, (height - 24) / card.offsetHeight, (width - 24) / card.offsetWidth);
    card.style.setProperty('--intro-fit', String(Math.max(0.1, fit)));
  }
  fitIntroduction();
  window.addEventListener('resize', fitIntroduction);
  window.visualViewport?.addEventListener('resize', fitIntroduction);
  window.addEventListener('load', fitIntroduction, {once:true});
  let messageIndex = 0;
  const introStarted = performance.now();
  const progressTimer = setInterval(() => {
    const progress = Math.min(100, Math.round((performance.now() - introStarted) / 40));
    $('#introPercent').textContent = String(progress).padStart(2, '0') + '%';
    $$('.intro-steps span').forEach((step, index) => step.classList.toggle('active', progress >= index * 34));
  }, 80);
  const messageTimer = setInterval(() => {
    messageIndex = Math.min(messageIndex + 1, introMessages.length - 1);
    $('#introStatus').textContent = introMessages[messageIndex];
  }, 1000);
  const introTimer = setTimeout(enterWorkspace, matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 4100);
  function enterWorkspace() {
    if (entered) return;
    entered = true;
    clearInterval(messageTimer); clearInterval(progressTimer); clearTimeout(introTimer);
    $('#welcome').classList.add('leaving');
    setTimeout(() => {
      $('#welcome').hidden = true; $('#workspace').hidden = false;
      window.removeEventListener('resize', fitIntroduction);
      window.visualViewport?.removeEventListener('resize', fitIntroduction);
      window.scrollTo(0, 0); $('#main').focus({preventScroll:true});
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
  }
  $('#skipIntro').addEventListener('click', enterWorkspace);

  // Native radio groups provide arrow-key navigation and independent values.
  function paintRating(group, preview) {
    const selected = Number($('input:checked', group)?.value || 0);
    const value = preview ?? selected;
    $$('label', group).forEach((label, index) => label.classList.toggle('lit', index < value));
    $('output', group).textContent = selected ? `${selected} out of 5 · ${ratingLabels[selected - 1]}` : 'Not rated';
  }
  $$('[data-rating]').forEach(group => {
    group.addEventListener('change', () => paintRating(group));
    $$('label', group).forEach((label, index) => label.addEventListener('mouseenter', () => paintRating(group, index + 1)));
    $('.stars', group).addEventListener('mouseleave', () => paintRating(group));
  });

  // Images are kept only as File objects and temporary object URLs in this tab.
  function clearUpload(name) {
    uploadVersions[name]++;
    if (urls[name]) URL.revokeObjectURL(urls[name]);
    urls[name] = null; files[name] = null;
    const group = $(`[data-upload="${name}"]`);
    $('input', group).value = '';
    $('img', group).hidden = true; $('img', group).removeAttribute('src');
    $('.upload-preview span', group).hidden = false;
    $('.filename', group).textContent = 'No image selected';
    $('[data-remove]', group).hidden = true;
    $('.error', group).textContent = '';
  }
  Object.keys(files).forEach(name => {
    const input = $('#' + name);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const group = $(`[data-upload="${name}"]`);
      const allowed = name === 'clientSignature' ? ['image/jpeg','image/png'] : ['image/jpeg','image/png','image/webp'];
      const version = ++uploadVersions[name];
      $('.error', group).textContent = '';
      if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
        input.value = '';
        $('.error', group).textContent = 'Choose a supported image no larger than 5 MB. Any previous preview is retained.';
        return;
      }
      const url = URL.createObjectURL(file);
      const probe = new Image(); probe.src = url;
      try { await probe.decode(); }
      catch { URL.revokeObjectURL(url); if(version === uploadVersions[name]) {input.value=''; $('.error',group).textContent='This file could not be opened as an image.';} return; }
      if(version !== uploadVersions[name]) {URL.revokeObjectURL(url); return;}
      if (urls[name]) URL.revokeObjectURL(urls[name]);
      urls[name] = url; files[name] = file;
      $('img', group).src = url; $('img', group).hidden = false;
      $('.upload-preview span', group).hidden = true;
      $('.filename', group).textContent = file.name;
      $('[data-remove]', group).hidden = false;
    });
    $(`[data-remove="${name}"]`).addEventListener('click', () => clearUpload(name));
  });
  function updatePlatform() {
    const isOther = $('#deploymentPlatform').value === 'Other';
    $('#otherPlatformWrap').hidden = !isOther;
    $('#otherPlatform').disabled = !isOther;
    $('#otherPlatform').required = isOther;
  }
  $('#deploymentPlatform').addEventListener('change', updatePlatform);
  updatePlatform();
  function updateCounter() { $('#feedbackCounter').textContent = `${$('#detailedFeedback').value.length} / 2000`; }
  $('#detailedFeedback').addEventListener('input', updateCounter);

  function fieldError(control) {
    if (control.disabled || !control.willValidate) return '';
    if (control.required && (control.type === 'checkbox' ? !control.checked : !control.value.trim())) return control.type === 'checkbox' ? 'Please accept the declaration to continue.' : 'Please complete this required field.';
    if (control.value && control.type === 'url') {
      try { const url = new URL(control.value); if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return 'Enter a complete HTTP or HTTPS URL.'; }
      catch { return 'Enter a full URL, for example https://example.com.'; }
    }
    if (control.validity.typeMismatch && control.type === 'email') return 'Enter a valid email address.';
    if (control.validity.rangeUnderflow) return 'Project cost cannot be negative.';
    if (!control.validity.valid) return 'Please enter a valid value.';
    return '';
  }
  function validate(focus = true) {
    validationAttempted = true;
    let firstInvalid;
    $$('input, textarea, select', form).forEach(control => {
      const error = fieldError(control);
      const errorElement = $('#' + control.id + 'Error');
      if (errorElement && control.type !== 'file') errorElement.textContent = error;
      if (error) { control.setAttribute('aria-invalid','true'); firstInvalid ||= control; }
      else control.removeAttribute('aria-invalid');
    });
    $('#validationStatus').textContent = firstInvalid ? 'Please check the highlighted fields before continuing.' : '';
    if (firstInvalid && focus) firstInvalid.focus();
    return !firstInvalid;
  }
  form.addEventListener('input', () => { if(validationAttempted) validate(false); });
  form.addEventListener('change', () => { if(validationAttempted) validate(false); });

  // Integration boundary: this object includes File values for future private uploads.
  function collectFormValues() {
    const data = new FormData(form);
    const record = {};
    Object.keys(labels).forEach(key => {
      if (key === 'submittedAt' || key === 'temporaryReference') return;
      if (key === 'declarationAccepted' || key === 'marketingConsent') record[key] = data.has(key);
      else if (key.endsWith('Rating')) record[key] = data.has(key) ? Number(data.get(key)) : null;
      else if (key === 'projectCost') record[key] = data.get(key) === '' ? null : Number(data.get(key));
      else record[key] = String(data.get(key) || '').trim();
    });
    record.clientProfile = files.clientProfile;
    record.clientSignature = files.clientSignature;
    return record;
  }
  // Build summaries with textContent, never with user-provided HTML.
  function buildSummary(record, compact = false) {
    const fragment = document.createDocumentFragment();
    const list = document.createElement('dl'); list.className = 'summary-grid';
    const keys = compact ? ['clientName','projectName','overallRating','submittedAt','temporaryReference'] : Object.keys(labels);
    keys.forEach(key => {
      if ((key === 'submittedAt' || key === 'temporaryReference') && !record[key]) return;
      if (key === 'otherPlatform' && record.deploymentPlatform !== 'Other') return;
      const row = document.createElement('div');
      if(['detailedFeedback','suggestions','projectNotes','temporaryReference'].includes(key)) row.className='wide';
      const dt = document.createElement('dt'); dt.textContent = labels[key];
      const dd = document.createElement('dd');
      let value = record[key];
      if(key.endsWith('Rating')) value = value ? `${value} out of 5 · ${ratingLabels[value-1]}` : 'Not rated';
      else if(key === 'marketingConsent') value = value ? 'Granted' : 'Not granted';
      else if(key === 'declarationAccepted') value = value ? 'Yes' : 'No';
      else if(key === 'submittedAt') value = new Date(value).toLocaleString();
      else if(key === 'projectCost' && value !== null) value = `${record.currency} ${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})}`;
      dd.textContent = value === null || value === '' || value === undefined ? 'Not provided' : String(value);
      row.append(dt,dd); list.append(row);
    });
    fragment.append(list);
    if(!compact) {
      const images = document.createElement('div'); images.className='summary-images';
      Object.keys(files).forEach(name => {
        if(!record[name] || !urls[name]) return;
        const figure=document.createElement('figure'); const img=document.createElement('img'); const caption=document.createElement('figcaption');
        img.src=urls[name]; img.alt=name === 'clientProfile' ? 'Client profile' : 'Authorized signature image';
        caption.textContent=record[name].name; caption.className='micro'; figure.append(img,caption); images.append(figure);
      });
      fragment.append(images);
    }
    return fragment;
  }
  function showReview(record, submitted = false) {
    $('#reviewTitle').textContent = submitted ? 'Submission summary' : 'Review your details';
    $('#reviewContent').replaceChildren(buildSummary(record));
    $('#returnToForm').textContent = submitted ? 'Return to confirmation' : 'Return to form';
    dialog.showModal();
  }
  $('#reviewDetails').addEventListener('click', () => { if(validate()) showReview(collectFormValues()); });
  $('#closeReview').addEventListener('click', () => dialog.close());
  $('#returnToForm').addEventListener('click', () => dialog.close());
  $('#viewSummary').addEventListener('click', () => { if(submittedRecord) showReview(submittedRecord,true); });

  // Shrinks the image in the browser (keeps the request under Vercel's 4.5 MB limit), returns base64.
  async function shrinkToBase64(file, maxSide, asPng) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale)); canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    if (!asPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height); bmp.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, asPng ? 'image/png' : 'image/jpeg', 0.85));
    if (!blob || blob.size > 1.4 * 1024 * 1024) throw new Error('Image is too large after resizing');
    return await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });
  }
  // Sends everything to our own serverless endpoint; Supabase keys never reach the browser.
  async function submitFeedback(record) {
    const {clientProfile, clientSignature, ...fields} = record;
    const images = {};
    if (clientProfile) images.profile = await shrinkToBase64(clientProfile, 800, false);
    if (clientSignature) images.signature = await shrinkToBase64(clientSignature, 700, true);
    const res = await fetch('/api/submit', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({fields, images, hp: $('#hpField').value})
    });
    if (!res.ok) throw new Error('Submit failed: ' + res.status + ' ' + await res.text());
    const out = await res.json();
    return {...record, submittedAt:out.submittedAt, temporaryReference:out.reference};
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if(busy || !validate()) return;
    busy=true;
    const controls=$$('input,textarea,select,button',form);
    const originalDisabled=controls.map(control=>control.disabled);
    const record=collectFormValues();
    controls.forEach(control=>control.disabled=true);
    $('#submitFeedback').textContent='Submitting…';
    form.setAttribute('aria-busy','true');
    try {
      submittedRecord=await submitFeedback(record);
      $('#successDetails').replaceChildren(buildSummary(submittedRecord,true));
      const printHeading=document.createElement('h1'); printHeading.textContent='NEXORASOLVEX';
      const printNote=document.createElement('p'); printNote.textContent='Client Feedback & Project Record';
      $('#printRecord').replaceChildren(printHeading,printNote,buildSummary(submittedRecord));
      $('#workspace').hidden=true; $('#success').hidden=false; window.scrollTo(0,0); $('#success').focus();
    } catch (error) {
      console.error(error);
      $('#validationStatus').textContent='We could not submit your feedback. Your entries are still here; please check your connection and try again.';
    } finally {
      busy=false; controls.forEach((control,index)=>control.disabled=originalDisabled[index]);
      $('#submitFeedback').textContent='Submit Feedback ↗'; form.removeAttribute('aria-busy');
    }
  });
  $('#printSummary').addEventListener('click', () => { if(submittedRecord) window.print(); });
  function resetForm() {
    form.reset(); Object.keys(files).forEach(clearUpload);
    $$('.error',form).forEach(element=>element.textContent='');
    $$('[aria-invalid]',form).forEach(element=>element.removeAttribute('aria-invalid'));
    $$('[data-rating]').forEach(group=>paintRating(group));
    validationAttempted=false; submittedRecord=null;
    $('#printRecord').replaceChildren(); $('#reviewContent').replaceChildren();
    updateCounter(); updatePlatform();
  }
  $('#resetForm').addEventListener('click', () => {
    if(!busy && confirm('Clear all entered details, ratings and selected images? This cannot be undone.')) {resetForm(); $('#clientName').focus();}
  });
  $('#anotherResponse').addEventListener('click', () => {
    if(confirm('Start a new response? The current local preview will be cleared. Print it first if you want to keep a copy.')) {
      resetForm(); $('#success').hidden=true; $('#workspace').hidden=false; window.scrollTo(0,0); $('#main').focus();
    }
  });
  // Decorative section navigation tracks the panel nearest the viewport.
  if('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting) $$('nav a').forEach(link=>link.classList.toggle('active',link.hash==='#'+entry.target.id));});
    },{rootMargin:'-10% 0px -65% 0px'});
    $$('form section').forEach(section=>observer.observe(section));
  }
})();
