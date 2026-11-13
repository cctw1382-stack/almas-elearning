// Rendering reads current application state; event handlers remain in the controller.
export function createCommunityPages({ repository, state, child, childPicker, esc, section, table, progressBar, manager, card, button, field }) {
function parentPage() {
  const c=child();if(!c)return section('متابعة الأبناء','<p>لا يوجد أبناء في بيانات العرض.</p>');
  let body=childPicker()+'<p>الصف: '+esc(c.grade)+'</p>';
  if(state.page==='attendance')body+=table(['الحصة','الحضور'],repository.list('attendance').filter(x=>x.childId===c.id).map(x=>[esc(x.name),esc(x.status)]),'حضور '+c.name);
  else {const student=repository.get('students',c.studentId);body+='<h3>'+esc(c.name)+'</h3><p>الصف: '+esc(c.grade)+'</p>'+progressBar(student?.progress??c.progress)+'<p>الدرجة التجريبية: '+esc(student?.grade??'غير متاحة')+'</p>';}
  return section(state.page==='attendance'?'حضور الأبناء':state.page==='children'?'الأبناء':'درجات الأبناء وإنجازهم',body);
}
function resultsPage() {
  if(state.role==='parent')return parentPage();
  if(manager())return section('التقارير التجريبية',table(['الطالب','الدرجة','التقدم'],repository.list('students').map(s=>[esc(s.name),s.grade+'%',s.progress+'%']))+'<p>عدد الدروس: '+repository.list('lessons').length+' — عدد الاختبارات: '+repository.list('exams').length+'</p>');
  const lessons=repository.list('lessons');
  return section('النتائج والتقدم','<div class="grid">'+lessons.map(l=>card(l.name,progressBar(repository.getLessonState(l.id).percent))).join('')+'</div><h3>نتائج الاختبارات</h3>'+repository.list('exams').map(e=>{const a=repository.getAttempt(e.id);return '<p>'+esc(e.name)+': '+(a?.status==='submitted'?a.score+' من '+a.total:a?.status==='active'?'محاولة جارية':'لا توجد محاولة')+'</p>';}).join(''));
}
function messagesPage() {
  return section('الرسائل','<div class="grid">'+repository.list('messages').filter(m=>m.role==='all'||m.role===state.role).map(m=>card(m.name,'<p>'+esc(m.detail)+'</p>')).join('')+'</div><form id="messageForm"><label for="msg">رسالة تجريبية محلية</label><textarea id="msg" required maxlength="2000" rows="3"></textarea><p><button class="btn" type="submit">إرسال تجريبي</button></p></form>');
}
function notificationsPage() {return section('الإشعارات',repository.list('notifications').filter(n=>n.role==='all'||n.role===state.role).map(n=>card(n.name,'<p>'+esc(n.detail)+'</p><p>'+esc(n.status)+'</p>',n.status==='جديد'?button('تحديد كمقروء','readNotification',n.id):'')).join(''));}
function profilePage() {return section('الملف الشخصي التجريبي','<p class="muted">احفظ اسماً مستعاراً للعرض فقط.</p><form id="profileForm">'+field('profileName','الاسم المستعار',repository.getSetting('alias-'+state.role,'مستخدم تجريبي'),'text','required minlength="2" maxlength="120"')+'<p><button class="btn" type="submit">حفظ الملف</button></p></form>');}

return { parentPage, resultsPage, messagesPage, notificationsPage, profilePage };
}
