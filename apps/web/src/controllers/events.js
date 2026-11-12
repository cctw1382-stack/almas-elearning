// Bind delegated UI events once; read current state when each event fires.
export function bindApplicationEvents({ document, window, repository, state, actions, go, el, notify, submitDialog, enter, render, recordList, pageKind, videoFiles, storageNotice }) {
document.addEventListener('click',event=>{
  const route=event.target.closest('[data-page]');if(route)return go(route.dataset.page);
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  try{const result=actions[target.dataset.action]?.(target.dataset.id,target);if(result?.catch)result.catch(error=>notify(error.message));}catch(error){if(el('dialog').open)el('dialogError').textContent=error.message;else notify(error.message);}
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  try{
    if(event.target.id==='dialogForm'){submitDialog();return;}
    if(event.target.id==='accountForm'){const name=el('accountName').value.trim();if(name.length<2){el('accountError').textContent='اكتب اسماً مستعاراً من حرفين على الأقل.';return;}repository.setSetting('alias-'+state.role,name);enter();}
    if(event.target.id==='profileForm'){const name=el('profileName').value.trim();if(name.length<2)throw new Error('اكتب اسماً من حرفين على الأقل.');repository.setSetting('alias-'+state.role,name);notify('تم حفظ الاسم التجريبي');}
    if(event.target.id==='messageForm'){const text=el('msg').value.trim();if(!text)throw new Error('اكتب الرسالة أولاً.');repository.save('messages',{name:repository.getSetting('alias-'+state.role,'مستخدم تجريبي'),detail:text,role:state.role,status:'مرسل'});render();notify('تمت إضافة الرسالة محلياً؛ لم تُرسل إلى أحد.');}
  }catch(error){if(el('dialog').open)el('dialogError').textContent=error.message;else notify(error.message);}
});
document.addEventListener('input',event=>{
  if(event.target.id==='search'){state.search=event.target.value;el('resultsList').innerHTML=recordList(pageKind());}
  if(event.target.id==='volume')el('lessonVideo').volume=Number(event.target.value);
});
document.addEventListener('change',event=>{
  const target=event.target;
  try{
    if(target.id==='role'){state.role=target.value;repository.setSetting('role',state.role);go('home');repository.setSetting('entered',true);}
    if(target.id==='filterStatus'||target.id==='subjectFilter'){state[target.id==='filterStatus'?'filter':'subject']=target.value;el('resultsList').innerHTML=recordList(pageKind());}
    if(target.id==='childSelect'){repository.setSetting('selectedChild',target.value);render();}
    if(target.id==='lessonSelect'){state.lessonId=target.value;repository.setSetting('lessonId',target.value);render();}
    if(target.id==='speed')el('lessonVideo').playbackRate=Number(target.value);
    if(target.id==='videoFile'){
      const file=target.files?.[0];if(!file)return;
      if(!file.type.startsWith('video/')||file.size>250*1024*1024){notify('اختر ملف فيديو صالحاً حتى 250 ميغابايت.');target.value='';return;}
      const old=videoFiles.get(state.lessonId);if(old)URL.revokeObjectURL(old.url);
      const entry={url:URL.createObjectURL(file)};videoFiles.set(state.lessonId,entry);el('mediaStatus').textContent='جارٍ تحميل الفيديو المحلي…';el('lessonVideo').src=entry.url;el('lessonVideo').playbackRate=Number(el('speed').value);
    }
    if(target.name==='answer'){const a=repository.getAttempt(state.examId),exam=repository.get('exams',state.examId);if(a.status==='active')repository.saveAttempt(state.examId,{answers:{...a.answers,[exam.questions[a.current].id]:Number(target.value)}});else render();}
    if(target.id==='markReview'){const a=repository.getAttempt(state.examId),q=repository.get('exams',state.examId).questions[a.current];repository.saveAttempt(state.examId,{review:target.checked?[...a.review,q.id]:a.review.filter(id=>id!==q.id)});}
    storageNotice();
  }catch(error){notify(error.message);}
});

el('theme').addEventListener('click',()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');el('theme').setAttribute('aria-pressed',String(dark));repository.setSetting('theme',dark?'dark':'light');storageNotice();});
if(repository.getSetting('theme','light')==='dark'){document.body.classList.add('dark');el('theme').setAttribute('aria-pressed','true');}
window.addEventListener('beforeunload',()=>{for(const file of videoFiles.values())URL.revokeObjectURL(file.url);});

}
