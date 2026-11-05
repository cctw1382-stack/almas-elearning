import { repository } from "./repository";

const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const menus = {
  student:[['home','الرئيسية'],['subjects','المواد الدراسية'],['lessons','الدروس'],['video','الفيديو التفاعلي'],['exams','الاختبارات'],['assignments','الواجبات'],['results','النتائج والتقدم'],['ai','التوصيات الذكية'],['notifications','الإشعارات'],['messages','الرسائل'],['profile','الملف الشخصي']],
  teacher:[['home','لوحة المعلم'],['subjects','إدارة المواد'],['lessons','إدارة الدروس'],['video','الفيديو والأسئلة'],['exams','الاختبارات'],['assignments','الواجبات'],['students','متابعة الطلاب'],['results','الإحصائيات'],['messages','الرسائل'],['notifications','الإشعارات'],['profile','الملف الشخصي']],
  parent:[['home','لوحة ولي الأمر'],['children','الأبناء'],['results','الدرجات والإنجاز'],['attendance','الحضور'],['assignments','الواجبات'],['exams','الاختبارات'],['notifications','الإشعارات'],['messages','الرسائل'],['profile','الملف الشخصي']],
  admin:[['home','لوحة الإدارة'],['users','المستخدمون'],['schools','المدارس'],['classes','الصفوف'],['subjects','المواد'],['lessons','الدروس'],['video','الفيديوهات'],['exams','الاختبارات'],['subscriptions','الاشتراكات'],['payments','المدفوعات'],['providers','مزودو الذكاء الاصطناعي'],['permissions','الصلاحيات'],['results','التقارير'],['audit','سجل العمليات'],['profile','الإعدادات']]
};
const titles = {subjects:'المواد الدراسية',lessons:'الدروس',exams:'الاختبارات',assignments:'الواجبات',students:'متابعة الطلاب',users:'المستخدمون',schools:'المدارس',classes:'الصفوف',subscriptions:'الاشتراكات',payments:'المدفوعات',providers:'مزودو الذكاء الاصطناعي',permissions:'الصلاحيات',audit:'سجل العمليات'};
const savedRole = repository.getSetting('role', 'student');
const state = {role:Object.hasOwn(menus,savedRole)?savedRole:'student',page:'welcome',search:'',filter:'',subject:'',lessonId:repository.getSetting('lessonId','l1'),examId:repository.getSetting('examId','e1'),examOpen:false,examReview:false,preview:false};
if (repository.getSetting('entered',false) === true) {
  const route = repository.getSetting('page','home');
  state.page = menus[state.role].some(([id])=>id===route)?route:'home';
}
let examInterval = null, dialogSubmit = null, dialogTrigger = null;
const videoFiles = new Map();
function button(label, action, id='', extra='') {return '<button type="button" class="btn" data-action="'+esc(action)+'" data-id="'+esc(id)+'" '+extra+'>'+esc(label)+'</button>';}
function section(title, body) {return '<section class="panel"><h2 tabindex="-1">'+esc(title)+'</h2>'+body+'</section>';}
function card(title, body, actions='') {return '<article class="card"><h3>'+esc(title)+'</h3>'+body+'<div class="controls">'+actions+'</div></article>';}
function notify(message) {el('toast').textContent=message;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el('toast').textContent='',4500);storageNotice();}
function storageNotice() {el('storageWarning').hidden=!repository.storageWarning;el('storageWarning').textContent=repository.storageWarning;}
function manager() {return state.role==='teacher'||state.role==='admin';}
function pageKind() {return state.page==='video'?'lessons':state.page;}
function child() {return repository.get('children',repository.getSetting('selectedChild','c1'))||repository.list('children')[0];}
function childPicker() {const c=child();return '<label for="childSelect">اختيار الابن</label><select id="childSelect">'+repository.list('children').map(x=>'<option value="'+esc(x.id)+'" '+(c?.id===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select>';}
function assignmentSubmission(record,studentId) {return record.submissions?.[studentId]||(studentId==='u1'?record.submission:'')||'';}
function recordStatus(record,kind) {
  if(kind!=='assignments'||manager())return record.status;
  const studentId=state.role==='parent'?child()?.studentId:'u1';
  if(assignmentSubmission(record,studentId))return 'تم التسليم';
  return record.status==='تم التسليم'?'مطلوب':record.status;
}
function table(headers,rows,caption='بيانات محلية تجريبية') {return '<div class="table-wrap"><table><caption>'+esc(caption)+'</caption><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function progressBar(percent) {return '<div class="progress" role="progressbar" aria-label="نسبة الإنجاز" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span style="width:'+percent+'%"></span></div><p>'+percent+'% مكتمل</p>';}
function go(page,preview=false,examOpen=false) {
  if(el('dialog').open) el('dialog').close();
  state.page=page;state.search='';state.filter='';state.subject='';state.preview=preview;state.examOpen=examOpen;state.examReview=false;
  repository.setSetting('page',page);render();el('main').focus({preventScroll:true});window.scrollTo({top:0,left:0,behavior:'instant'});
}
// Original inline vector assets keep the prototype self-contained and offline.
function icon(name) {
  const paths={home:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',subjects:'M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3ZM12 6v15',lessons:'M7 3h10l4 4v14H3V3h4m9 0v5h5M7 12h10M7 16h6',video:'M3 5h18v14H3ZM10 9l5 3-5 3Z',exams:'M8 4H4v17h16V4h-4M8 3h8v4H8ZM8 12l2 2 5-5M8 18h8',assignments:'M4 4h16v17H4ZM8 8h8M8 12h8M8 16h4',results:'M4 20V10h4v10m4 0V4h4v16m4 0v-7h3v7M2 21h21',ai:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM19 2v4m-2-2h4',notifications:'M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3ZM10 21h4',messages:'M3 4h18v13H8l-5 4ZM7 8h10M7 12h6',profile:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3',children:'M9 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM1 21v-3a5 5 0 0 1 10 0v3m2 0v-3a5 5 0 0 1 10 0v3',attendance:'M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16m-11 6 2 2 4-4',arrow:'M19 12H5m6-6-6 6 6 6',check:'m5 12 4 4L19 6',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 2',shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6ZM8 12l3 3 5-6'};
  return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name]||paths.subjects)+'"/></svg>';
}
function brandMark(){return document.querySelector('.brand-mark').outerHTML;}
function subjectArt(name='') {
  let drawing;
  if(name.includes('أحياء'))drawing='<circle cx="44" cy="44" r="36" fill="#d7f3e9"/><path d="M63 20C31 19 18 35 27 56c22 11 43-7 36-36Z" fill="#008176"/><path d="M26 66 54 32m-16 8v12m7-6h12" fill="none" stroke="#b2f4dc" stroke-width="3" stroke-linecap="round"/>';
  else if(name.includes('كيمياء'))drawing='<circle cx="44" cy="44" r="36" fill="#f1e0f7"/><path d="M35 19h18m-15 0v20L23 64q-2 7 6 7h30q8 0 5-7L50 39V19" fill="#c58bd6" stroke="#854291" stroke-width="3"/><path d="m30 55-5 10q-1 3 4 3h30q5 0 3-3l-5-10Z" fill="#854291"/><circle cx="44" cy="51" r="3" fill="#fff"/><circle cx="51" cy="61" r="2" fill="#edc7ff"/>';
  else if(name.includes('فيزياء'))drawing='<circle cx="44" cy="44" r="36" fill="#fff0ca"/><g fill="none" stroke="#b17210" stroke-width="2.5"><ellipse cx="44" cy="44" rx="31" ry="12"/><ellipse cx="44" cy="44" rx="31" ry="12" transform="rotate(60 44 44)"/><ellipse cx="44" cy="44" rx="31" ry="12" transform="rotate(120 44 44)"/></g><circle cx="44" cy="44" r="6" fill="#e3a215"/><circle cx="69" cy="37" r="4" fill="#2448b8"/>';
  else drawing='<circle cx="44" cy="44" r="36" fill="#dce8ff"/><rect x="24" y="17" width="42" height="54" rx="8" fill="#4775d8" transform="rotate(-8 44 44)"/><path d="M33 34h22m-22 0 13 14-13 14h22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M57 21h5v5" fill="none" stroke="#abc4ff" stroke-width="3"/>';
  return '<svg class="subject-art" viewBox="0 0 88 88" aria-hidden="true">'+drawing+'</svg>';
}
function learningArt(){return '<div class="hero-art"><svg viewBox="0 0 570 475" aria-hidden="true"><circle cx="294" cy="237" r="201" fill="#ffffff08"/><circle cx="294" cy="237" r="173" fill="none" stroke="#ffffff20"/><path d="m93 138 23-12 23 12-23 13Z" fill="#ffdd72"/><path d="m93 138 23 13v26l-23-13Z" fill="#d99f22"/><path d="m116 151 23-13v26l-23 13Z" fill="#ffcf43"/><path d="m457 345 27-15 27 15-27 16Z" fill="#7ee3d5"/><path d="m457 345 27 16v31l-27-16Z" fill="#007b78"/><path d="m484 361 27-16v31l-27 16Z" fill="#28b7a6"/><path d="m473 108 8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3Z" fill="#ffcf43"/><rect x="93" y="119" width="366" height="264" rx="18" fill="#0b245d" opacity=".25" transform="rotate(-5 276 251)"/><g transform="rotate(-5 276 251)"><rect x="86" y="105" width="366" height="264" rx="18" fill="#f8fbff"/><path d="M104 105h330q18 0 18 18v20H86v-20q0-18 18-18" fill="#dce8ff"/><circle cx="106" cy="124" r="4" fill="#7798d9"/><circle cx="120" cy="124" r="4" fill="#a8bdea"/><circle cx="134" cy="124" r="4" fill="#a8bdea"/><rect x="173" y="118" width="129" height="11" rx="5" fill="#bdcff1"/><rect x="105" y="159" width="236" height="155" rx="10" fill="#133677"/><g fill="none" stroke="#88accb" stroke-width="1" opacity=".25"><path d="M125 159v155m32-155v155m32-155v155m32-155v155m32-155v155m32-155v155m32-155v155M105 187h236m-236 30h236m-236 30h236m-236 30h236"/></g><path d="m137 258 32-32 29 15 52-49 42 16" fill="none" stroke="#7ee3d5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="223" cy="236" r="23" fill="#fff"/><path d="m218 224 16 12-16 12Z" fill="#2448b8"/><path d="M360 166h66M360 181h48" stroke="#a8bdea" stroke-width="7" stroke-linecap="round"/><rect x="357" y="203" width="76" height="41" rx="7" fill="#e0eaff"/><rect x="357" y="257" width="76" height="41" rx="7" fill="#d7f3e9"/><path d="M109 338h190" stroke="#dce8ff" stroke-width="7" stroke-linecap="round"/><path d="M109 338h106" stroke="#007b78" stroke-width="7" stroke-linecap="round"/><circle cx="216" cy="338" r="6" fill="#007b78"/></g><g transform="translate(121 283)"><ellipse cx="98" cy="149" rx="97" ry="13" fill="#0b245d" opacity=".23"/><path d="M25 133c0-48 18-69 66-69s67 21 67 69" fill="#ffcf43"/><path d="M76 59v24q18 16 33 0V59" fill="#ce8a62"/><path d="M61 38c0-36 65-40 65-3v22c0 23-18 37-32 37S61 80 61 57Z" fill="#e7a77b"/><path d="M60 48C43 18 65-7 98 0c25-3 38 14 28 45l-6-21c-17 12-36 4-49 0Z" fill="#172b4d"/><path d="m40 100 42 23m61-23-42 23" stroke="#ce8a62" stroke-width="16" stroke-linecap="round"/><path d="m40 99 52 13 52-13v47l-52 12-52-12Z" fill="#eef3ff"/><path d="m92 112 52-13v47l-52 12Z" fill="#abc4ff"/><path d="M92 112v46" stroke="#2448b8" stroke-width="3"/><path d="m52 116 26 6m-26 7 26 6m26-13 28-7m-28 20 28-7" stroke="#7798d9" stroke-width="3" stroke-linecap="round"/></g><path d="m62 271 7 7m-7 0 7-7m409-78 8 8m-8 0 8-8M310 59v12m-6-6h12" stroke="#8db4ff" stroke-width="3" stroke-linecap="round"/></svg><div class="art-chip top">'+icon('check')+'<div><strong>كل خطوة، إنجاز</strong><p>شاهد، جرّب، ثم اختبر فهمك</p></div></div><div class="art-chip bottom">'+icon('subjects')+'<div><strong>معرفتك تكبر معك</strong><p>دروسك ونتائجك في مكان واحد</p></div></div></div>';}
function subjectTiles(publicView=false){return '<div class="subject-grid '+(publicView?'':'dashboard-catalogue')+'">'+repository.list('subjects').map(s=>'<article class="subject-card">'+subjectArt(s.name)+'<span class="subject-tag">'+esc(s.teacher||'مسار تعليمي')+'</span><h3>'+esc(s.name)+'</h3><p>'+esc(s.detail||'اكتشف دروس المادة وابدأ التعلّم.')+'</p>'+button('استكشف الدروس',publicView?'discover':'subjectLessons',s.id)+'</article>').join('')+'</div>';}
function welcome(){return '<div class="landing"><section class="hero"><div class="container hero-grid"><div class="hero-copy"><span class="hero-label"><i></i> مساحة تعلّم عربية، بطموحك</span><h2>مرحباً بك في الماس.<br><span>هنا تبدأ حكاية تفوّقك.</span></h2><p>افهم بطريقتك، وتقدّم بخطواتك. دروس تفاعلية، أسئلة تختبر فهمك، ومساحة تجمع الطالب والمعلّم وولي الأمر.</p><div class="hero-actions">'+button('إنشاء حساب تجريبي','register').replace('class="btn"','class="btn yellow"')+button('دخول تجريبي','login').replace('class="btn"','class="btn ghost"')+'</div><button type="button" class="guest-link" data-action="guest">تجربة كضيف</button></div>'+learningArt()+'</div></section><div class="hero-note"><div class="container note-items"><span>'+icon('video')+' فيديو وأسئلة تفاعلية</span><span>'+icon('results')+' تقدّم تقدر تشوفه</span><span>'+icon('children')+' متابعة أقرب للأبناء</span></div></div><section class="container landing-section" id="explore"><div class="section-heading"><p class="eyebrow">كل فكرة تفتح لك باباً</p><h2>اختر مادتك، وابدأ اكتشافك</h2><p>جولة في مواد العرض التجريبي. اختر المادة لتنتقل مباشرة إلى دروسها.</p></div>'+subjectTiles(true)+'</section><section class="soft-section" id="how-it-works"><div class="container landing-section"><div class="section-heading"><p class="eyebrow">تعلّم أمتع. فهم أعمق.</p><h2>رحلة بسيطة، من الدرس إلى الإنجاز</h2><p>أدوات تساعدك تفهم، تطبّق، وتعرف خطوتك الجاية.</p></div><div class="journey-grid">'+[['video','شاهد وتفاعل','اختر فيديو من جهازك، دوّن ملاحظاتك، وأجب عن سؤال داخل الدرس.'],['exams','اختبر فهمك','جرّب اختباراً بوقت محدد، وراجع إجاباتك والنتيجة بعد التسليم.'],['results','تابع خطواتك','ارجع إلى تقدمك المحفوظ، وتابع إنجاز الأبناء من لوحة ولي الأمر.']].map(([i,t,d])=>'<article class="journey-card"><div class="journey-icon">'+icon(i)+'</div><h3>'+t+'</h3><p>'+d+'</p></article>').join('')+'</div></div></section><div class="container"><section class="learning-banner"><div><p class="eyebrow" style="color:#ffdd72">مساحة واحدة، أدوار تتكامل</p><h2>للطالب طموح، وللمعلّم أثر.<br>وللأهل مكان في الرحلة.</h2><p>تنقّل بين الأدوار الأربعة من داخل المنصة، واستكشف تجربة كل دور ببيانات العرض المحلية.</p></div>'+button('جرّب المنصة الآن','guestBanner').replace('class="btn"','class="btn yellow"')+'</section></div><section class="container landing-section faq-grid" id="faq"><div class="faq-intro"><p class="eyebrow">قبل أن تبدأ</p><h2>أسئلة في بالك؟<br>خلّينا نوضحها.</h2><p>هذه نسخة تفاعلية لاستكشاف المنصة وتجربة الواجهة على أجهزتك.</p></div><div class="faq-list"><details><summary>كيف أبدأ تجربة المنصة؟</summary><p>اختر «تجربة كضيف» للبدء مباشرة، أو أدخل اسماً مستعاراً في الدخول التجريبي. يمكنك تبديل الدور من أعلى الشاشة.</p></details><details><summary>هل أحتاج حساباً حقيقياً أو اشتراكاً؟</summary><p>كل ما تراه هنا بيانات تجريبية محلية. لا يوجد تسجيل حقيقي أو اشتراك مدفوع في هذه النسخة.</p></details><details><summary>أين تُحفظ الملاحظات والنتائج؟</summary><p>تُحفظ على متصفح هذا الجهاز عند توفر التخزين المحلي. استخدم بيانات وهمية؛ لا تنتقل التغييرات تلقائياً بين الهاتف والحاسوب.</p></details><details><summary>هل تعمل المنصة على الهاتف؟</summary><p>نعم، تتكيّف الواجهة مع حجم الشاشة. اسحب قائمة الأقسام أفقياً للوصول إلى بقية الصفحات، ويمكن تمرير جداول الإدارة داخل إطارها.</p></details></div></section></div>';}
function account(){return '<div class="account-shell"><div class="account-visual">'+brandMark()+'<h2>خطوتك الأولى،<br>نحو معرفة أكبر.</h2><p>مساحتك للتعلّم والتجربة، مع منصة الماس.</p><span class="small">نسخة تجريبية • بيانات محلية فقط</span></div>'+section(state.page==='login'?'تسجيل الدخول التجريبي':'إنشاء حساب تجريبي','<p class="muted">استخدم اسماً مستعاراً وهمياً. لا نطلب كلمة مرور أو بريداً إلكترونياً.</p><form id="accountForm"><label for="accountName">الاسم المستعار التجريبي</label><input id="accountName" minlength="2" maxlength="120" required autocomplete="off" placeholder="بماذا نناديك؟"><p style="margin-top:22px"><button class="btn" type="submit">متابعة تجريبية</button></p><p id="accountError" class="error" role="alert"></p></form>')+'</div>';}
function home() {
  const lessons=repository.list('lessons'),subjects=repository.list('subjects');
  const selectedChild=child(),childProgress=selectedChild?(repository.get('students',selectedChild.studentId)?.progress??selectedChild.progress):0;
  const average=lessons.length?Math.round(lessons.reduce((sum,l)=>sum+repository.getLessonState(l.id).percent,0)/lessons.length):0;
  const data=state.role==='admin'?[['المستخدمون',repository.list('users').length,'children'],['المدارس',repository.list('schools').length,'home'],['المواد',subjects.length,'subjects'],['الاشتراكات',repository.list('subscriptions').length,'shield']]:state.role==='teacher'?[['الطلاب',repository.list('students').length,'children'],['الدروس',lessons.length,'video'],['الاختبارات',repository.list('exams').length,'exams'],['الواجبات',repository.list('assignments').length,'assignments']]:state.role==='parent'?[['الأبناء',repository.list('children').length,'children'],['الابن المحدد',selectedChild?.name||'لا يوجد','profile'],['الإنجاز',childProgress+'%','results']]:[['المواد',subjects.length,'subjects'],['الدروس',lessons.length,'video'],['تقدم المشاهدة',average+'%','results'],['الاختبارات',repository.list('exams').length,'exams']];
  const copy={student:['كل يوم، فرصة لتعرف أكثر','اختر مادة تثير فضولك، أكمل درسك، وخذ خطوة جديدة نحو هدفك.','استكشف دروسك','lessons'],teacher:['أهلاً بصانع الأثر','نظّم محتواك التعليمي، حضّر أسئلتك، وتابع خطوات طلابك من مساحتك.','إدارة الدروس','lessons'],parent:['قريب من رحلتهم، في كل خطوة','تابع إنجاز الأبناء ومهامهم، وكن جزءاً من خطواتهم الصغيرة نحو التقدّم.','متابعة الأبناء','children'],admin:['رؤية أوضح، وإدارة أسهل','المستخدمون والمحتوى والتقارير؛ أدواتك اليومية في مساحة منظمة.','إدارة المستخدمين','users']}[state.role];
  return '<section class="dashboard-hero"><div><p class="eyebrow">'+copy[0]+'</p><h2>مرحباً '+esc(repository.getSetting('alias-'+state.role,'بك في لوحة '+el('role').selectedOptions[0].textContent))+'</h2><p>'+copy[1]+'</p><button type="button" class="btn yellow" data-page="'+copy[3]+'">'+copy[2]+icon('arrow')+'</button></div><div class="dashboard-art">'+brandMark()+'</div></section>'+(state.role==='parent'?section('نظرة على إنجاز الأبناء',childPicker()):'')+'<div class="stat-grid">'+data.map(([name,value,i])=>'<article class="stat-card"><span class="stat-icon">'+icon(i)+'</span><div><h3>'+esc(name)+'</h3><p>'+esc(value)+'</p></div></article>').join('')+'</div>'+(state.role==='student'?'<div class="section-row"><h2>موادك، بداية رحلتك</h2><button type="button" class="btn ghost" data-page="subjects">جميع المواد '+icon('arrow')+'</button></div>'+subjectTiles():section('اختصارات مساحتك','<div class="grid">'+(state.role==='teacher'?[['video','الفيديو والأسئلة','حضّر دروساً يتفاعل معها الطالب.'],['students','متابعة الطلاب','اطّلع على بيانات الطلاب وتقدمهم.'],['results','الإحصائيات','اقرأ مؤشرات مساحتك التعليمية.']]:state.role==='parent'?[['assignments','الواجبات','تعرف إلى المهام المخصصة للابن المحدد.'],['results','الدرجات والإنجاز','تابع النتائج وخطوات التعلّم.'],['messages','الرسائل','تواصل ضمن تجربة العرض المحلية.']]:[['users','المستخدمون','نظّم سجلات مستخدمي العرض.'],['subjects','المواد','أدر المحتوى والمواد التعليمية.'],['audit','سجل العمليات','راجع التغييرات المحلية الأخيرة.']]).map(([id,t,d])=>card(t,'<p>'+d+'</p>','<button type="button" class="btn ghost" data-page="'+id+'">فتح القسم '+icon('arrow')+'</button>')).join('')+'</div>'))+'<p class="dashboard-note">الأرقام محسوبة من بيانات العرض المحلية.'+(state.role==='student'?' هذا الدور يعرض بيانات الطالب الافتراضي '+esc(repository.get('students','u1')?.name||'')+'. الاسم المستعار يغيّر اسم العرض فقط.':'')+'</p>';
}
function searchControls(kind) {
  const statuses=[...new Set([...repository.list(kind).map(x=>recordStatus(x,kind)),state.filter].filter(Boolean))];
  return '<div class="controls"><div><label for="search">بحث</label><input id="search" type="search" maxlength="120" placeholder="ابحث بالاسم أو التفاصيل" value="'+esc(state.search)+'"></div><div><label for="filterStatus">تصفية الحالة</label><select id="filterStatus"><option value="">كل الحالات</option>'+statuses.map(s=>'<option value="'+esc(s)+'" '+(state.filter===s?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></div>'+(['lessons','exams','assignments'].includes(kind)?'<div><label for="subjectFilter">تصفية المادة</label><select id="subjectFilter"><option value="">كل المواد</option>'+repository.list('subjects').map(s=>'<option value="'+esc(s.id)+'" '+(state.subject===s.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></div>':'')+'</div>';
}
function recordList(kind) {
  const viewer=state.role==='parent'?child()?.studentId:state.role==='student'?'u1':null;
  const items=repository.list(kind).filter(x=>(x.name+' '+(x.detail||'')+' '+(x.teacher||'')).toLocaleLowerCase('ar').includes(state.search.trim().toLocaleLowerCase('ar'))&&(!state.filter||recordStatus(x,kind)===state.filter)&&(!state.subject||x.subjectId===state.subject)&&(!viewer||!x.studentIds||x.studentIds.includes(viewer)));
  if(!items.length) return '<p class="muted" role="status">لا توجد سجلات مطابقة لهذا الاختيار.'+(manager()?' غيّر البحث أو أضف سجلاً.':'')+'</p>';
  const rows=items.map(x=>{
    let controls=button('التفاصيل','detail',x.id);
    if(manager()&&kind!=='audit') controls+=button('تعديل','edit',x.id)+button('حذف','delete',x.id);
    if(kind==='lessons') controls+=button(manager()?'معاينة الفيديو':'فتح الدرس','openVideo',x.id);
    if(kind==='subjects'&&!manager())controls+=button('دروس المادة','subjectLessons',x.id);
    if(kind==='exams') {
      const attempt=repository.getAttempt(x.id);
      controls+=state.role==='student'?button(attempt?.status==='active'?'استئناف الاختبار':attempt?.status==='submitted'?'عرض النتيجة':'ابدأ الاختبار','openExam',x.id):manager()?button('معاينة الاختبار','previewExam',x.id):'';
    }
    if(kind==='assignments'&&state.role==='student')controls+=button(assignmentSubmission(x,'u1')?'تعديل التسليم':'تسليم الواجب','assignment',x.id);
    if(kind==='assignments'&&manager())controls+=button('عرض التسليمات','submissions',x.id);
    let detail=esc(x.teacher||x.detail||x.duration||'—');const status='<span class="pill">'+esc(recordStatus(x,kind)||'تجريبي')+'</span>';
    if(state.role==='parent'&&kind==='exams'){const attempt=child()?.studentId==='u1'?repository.getAttempt(x.id):null;detail+='<p>نتيجة '+esc(child()?.name||'الابن')+': '+(attempt?.status==='submitted'?attempt.score+' من '+attempt.total:attempt?.status==='active'?'محاولة جارية':'لا توجد محاولة محلية لهذا الابن')+'</p>';}
    if(!manager()&&['subjects','lessons'].includes(kind))return '<article class="card course-card"><div class="course-cover">'+subjectArt(kind==='subjects'?x.name:repository.get('subjects',x.subjectId)?.name||'')+icon(kind==='subjects'?'subjects':'video')+'</div><div class="course-body"><h3>'+esc(x.name)+'</h3><p>'+detail+'</p><p>'+status+'</p><div class="controls">'+controls+'</div></div></article>';
    if(!manager())return card(x.name,'<p>'+detail+'</p><p>'+status+'</p>',controls);
    return [esc(x.name),detail,status,'<div class="controls">'+controls+'</div>'];
  });
  return manager()?table(['الاسم','التفاصيل','الحالة','الإجراءات'],rows):'<div class="grid">'+rows.join('')+'</div>';
}
function recordsPage(kind) {
  return section(titles[kind]||'السجلات',(state.role==='parent'?childPicker()+'<p>متابعة '+esc(child()?.name||'الابن')+' — '+esc(child()?.grade||'')+'. تظهر المهام المخصصة لهذا الابن؛ التسليم متاح في دور الطالب فقط.</p>':'')+(['payments','subscriptions','providers','permissions'].includes(kind)?'<p class="muted">سجلات محاكاة محلية فقط. لا اتصال بمزود خارجي ولا تغيير لصلاحيات أو دفع حقيقي.</p>':'')+searchControls(kind)+(manager()&&kind!=='audit'?'<p>'+button('إضافة سجل','create')+'</p>':'')+'<div id="resultsList">'+recordList(kind)+'</div>');
}
function showDialog(title,body,onSubmit=null) {
  const dialog=el('dialog');dialogTrigger=document.activeElement;dialogSubmit=onSubmit;
  dialog.innerHTML='<h2 id="dialogTitle">'+esc(title)+'</h2><form id="dialogForm">'+body+'<p id="dialogError" class="error" role="alert"></p></form>';
  dialog.showModal();dialog.querySelector('[autofocus],input,textarea,select,button')?.focus();
}
function field(id,label,value='',type='text',extra='') {return '<label for="'+id+'">'+esc(label)+'</label><input id="'+id+'" name="'+id+'" type="'+type+'" value="'+esc(value)+'" '+extra+'>';}
function optionFields(question,index,prefix='q') {
  const id=prefix+index;
  return '<fieldset class="question-editor" data-qid="'+esc(question?.id||'q-'+Date.now()+'-'+Math.random().toString(36).slice(2))+'"><legend>'+(prefix==='cp'?'سؤال التوقف عند منتصف الفيديو':'سؤال '+(index+1))+'</legend>'+field(id+'text','السؤال',question?.text||'','text','required maxlength="2000"')+['الأول','الثاني','الثالث'].map((name,n)=>field(id+'o'+n,'الخيار '+name,question?.options[n]||'','text','required maxlength="500"')).join('')+'<label for="'+id+'correct">الإجابة الصحيحة</label><select id="'+id+'correct">'+['الأول','الثاني','الثالث'].map((name,n)=>'<option value="'+n+'" '+(question?.correct===n?'selected':'')+'>'+name+'</option>').join('')+'</select>'+(prefix==='q'?button('حذف السؤال','removeQuestion'):'')+'</fieldset>';
}
function readQuestion(node,index,prefix='q') {const id=prefix+index;return {id:node.dataset.qid,text:el(id+'text').value.trim(),options:[0,1,2].map(n=>el(id+'o'+n).value.trim()),correct:Number(el(id+'correct').value)};}
function editRecord(id) {
  const kind=pageKind(),record=id?repository.get(kind,id):null;
  if(!manager()||kind==='audit')return;
  const subjects=repository.list('subjects');
  const status=record?.status||'نشط';
  let body=field('recordName','الاسم',record?.name||'','text','required maxlength="120" autofocus')+'<label for="recordDetail">التفاصيل</label><textarea id="recordDetail" maxlength="2000">'+esc(record?.detail||'')+'</textarea>'+field('recordStatus','الحالة',status,'text','required maxlength="120"');
  if(kind==='subjects')body+=field('recordTeacher','المعلم',record?.teacher||'','text','maxlength="120"');
  if(['lessons','exams','assignments'].includes(kind))body+='<label for="recordSubject">المادة</label><select id="recordSubject" required>'+subjects.map(s=>'<option value="'+esc(s.id)+'" '+(record?.subjectId===s.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select>';
  if(kind==='lessons')body+=field('recordDuration','مدة الدرس',record?.duration||'10 دقائق','text','required maxlength="40"')+optionFields(record?.checkpoint,0,'cp');
  if(kind==='exams')body+=field('recordDuration','المدة بالدقائق',(record?.duration||300)/60,'number','required min="1" max="180" step="1"')+'<div id="questionEditors">'+(record?.questions||[null]).map((q,i)=>optionFields(q,i)).join('')+'</div>'+button('إضافة سؤال','addQuestion');
  if(['exams','assignments'].includes(kind))body+='<fieldset><legend>الطلاب المشمولون</legend>'+repository.list('students').map(s=>'<label><input type="checkbox" name="audience" value="'+esc(s.id)+'" '+(!record?.studentIds||record.studentIds.includes(s.id)?'checked':'')+'> '+esc(s.name)+'</label>').join('')+'</fieldset>';
  if(kind==='students')body+=field('recordGrade','الدرجة',record?.grade||0,'number','required min="0" max="100"')+field('recordProgress','التقدم',record?.progress||0,'number','required min="0" max="100"');
  body+='<p class="controls"><button class="btn" type="submit">حفظ</button>'+button('إلغاء','closeDialog')+'</p>';
  showDialog(id?'تعديل سجل':'إضافة سجل',body,()=>{
    const updated={...(record||{}),name:el('recordName').value.trim(),detail:el('recordDetail').value.trim(),status:el('recordStatus').value.trim()};
    if(kind==='subjects')updated.teacher=el('recordTeacher').value.trim();
    if(el('recordSubject'))updated.subjectId=el('recordSubject').value;
    if(kind==='lessons'){updated.duration=el('recordDuration').value.trim();updated.checkpoint=readQuestion(el('dialog').querySelector('.question-editor'),0,'cp');delete updated.checkpoint.id;}
    if(kind==='exams'){updated.duration=Number(el('recordDuration').value)*60;updated.questions=[...el('questionEditors').children].map((node,i)=>readQuestion(node,i));}
    if(['exams','assignments'].includes(kind))updated.studentIds=[...el('dialog').querySelectorAll('[name="audience"]:checked')].map(input=>input.value);
    if(kind==='students'){updated.grade=Number(el('recordGrade').value);updated.progress=Number(el('recordProgress').value);}
    repository.save(kind,updated);el('dialog').close();render();notify('تم حفظ السجل محلياً');
  });
}
function details(id) {
  const kind=pageKind(),x=repository.get(kind,id);if(!x)return;
  showDialog('تفاصيل '+x.name,'<p>'+esc(x.detail||'بيانات عرض محلية')+'</p><p>الحالة: '+esc(x.status||'تجريبي')+'</p>'+(x.teacher?'<p>المعلم: '+esc(x.teacher)+'</p>':'')+(kind==='exams'?'<p>'+x.questions.length+' أسئلة — '+Math.round(x.duration/60)+' دقائق</p>':'')+(x.subjectId?'<p>المادة: '+esc(repository.get('subjects',x.subjectId)?.name||'')+'</p>':'')+'<p>'+button('إغلاق','closeDialog')+'</p>');
}
function deleteRecord(id) {
  const kind=pageKind(),x=repository.get(kind,id);if(!manager()||!x)return;
  showDialog('حذف سجل','<p>هل تريد حذف «'+esc(x.name)+'» من بيانات العرض على هذا الجهاز؟</p><p class="controls"><button type="submit" class="btn">تأكيد الحذف</button>'+button('إلغاء','closeDialog')+'</p>',()=>{repository.remove(kind,id);el('dialog').close();render();notify('تم حذف السجل محلياً');});
}
function videoState() { return repository.getLessonState(state.lessonId,manager()?state.role:'student'); }
function saveVideoState(patch) { return repository.saveLessonState(state.lessonId,patch,manager()?state.role:'student'); }
function videoPage() {
  const lessons=repository.list('lessons');if(!lessons.length)return section('مشغل الفيديو التفاعلي','<p>لا توجد دروس. أضف درساً من دور المعلم.</p>');
  const lesson=lessons.find(x=>x.id===state.lessonId)||lessons[0];state.lessonId=lesson.id;const data=repository.getLessonState(lesson.id,manager()?state.role:'student');
  return section('مشغل الفيديو التفاعلي','<label for="lessonSelect">الدرس</label><select id="lessonSelect">'+lessons.map(l=>'<option value="'+esc(l.id)+'" '+(l.id===lesson.id?'selected':'')+'>'+esc(l.name)+'</option>').join('')+'</select><h3>'+esc(lesson.name)+'</h3><p class="muted">اختر فيديو من جهازك؛ الملف لا يغادر المتصفح. بعد التحديث أعد اختيار الملف لاستئناف الموضع المحفوظ. المحاكاة متاحة دون ملف.</p><label for="videoFile">اختيار فيديو محلي (حتى 250 ميغابايت)</label><input type="file" id="videoFile" accept="video/*"><p id="mediaStatus" role="status">اختر ملفاً أو جرّب التقدم بالمحاكاة.</p><video id="lessonVideo" controls playsinline preload="metadata" aria-label="مشغل الدرس"></video><div class="controls"><label for="speed">سرعة التشغيل</label><select id="speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><label for="volume">الصوت</label><input id="volume" type="range" min="0" max="1" step="0.1" value="1">'+button('ملء الشاشة','fullscreen')+'</div><p>التقدم المحفوظ: <strong id="videoPercent">'+data.percent+'%</strong></p><div id="videoProgress" class="progress" role="progressbar" aria-label="تقدم الفيديو" aria-valuenow="'+data.percent+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+data.percent+'%"></span></div><div class="controls">'+button('تقدم محاكاة 25%','advance')+button('إعادة التقدم','resetVideo')+button('حفظ علامة مرجعية','bookmark')+button('الانتقال إلى العلامة','seekBookmark')+'</div><p id="bookmarkStatus"></p><div id="checkpoint" class="panel" hidden role="group" aria-labelledby="checkpointTitle"><h3 id="checkpointTitle" tabindex="-1">سؤال أثناء المشاهدة</h3><p>'+esc(lesson.checkpoint.text)+'</p><div class="controls">'+lesson.checkpoint.options.map((o,i)=>button(o,'checkpoint',String(i))).join('')+'</div><p id="checkpointError" role="alert" class="error"></p></div><label for="notes">ملاحظاتي الخاصة</label><textarea id="notes" rows="4" maxlength="10000">'+esc(data.notes)+'</textarea><p>'+button('حفظ الملاحظات','saveNotes')+'</p>');
}
function updateVideoUI() {
  const data=videoState();el('videoPercent').textContent=data.percent+'%';el('videoProgress').setAttribute('aria-valuenow',data.percent);el('videoProgress').firstElementChild.style.width=data.percent+'%';
  el('bookmarkStatus').textContent=data.bookmark===null?'لا توجد علامة مرجعية.':'علامة مرجعية عند '+Math.floor(data.bookmark)+' ثانية.';
  el('checkpoint').hidden=data.checkpointAnswered||data.percent<50;storageNotice();
}
function checkVideoProgress(percent,seconds) {
  const data=videoState(),video=el('lessonVideo');
  const blocked=percent>=50&&!data.checkpointAnswered;
  if(blocked) {video.pause();percent=50;if(Number.isFinite(video.duration)&&seconds>video.duration/2){seconds=video.duration/2;video.currentTime=seconds;}}
  const wasHidden=el('checkpoint').hidden;
  saveVideoState({percent:Math.max(0,Math.min(100,Math.floor(percent))),seconds:Math.max(0,seconds)});updateVideoUI();
  if(blocked&&wasHidden)el('checkpointTitle').focus();
}
function bindVideo() {
  const video=el('lessonVideo'),file=videoFiles.get(state.lessonId);
  const current=()=>video.isConnected&&el('lessonVideo')===video;
  video.addEventListener('loadedmetadata',()=>{if(!current())return;const data=videoState();video.currentTime=Math.min(data.seconds,Number.isFinite(video.duration)?video.duration:0);el('mediaStatus').textContent='الفيديو المحلي جاهز؛ استُعيد موضع المشاهدة.';});
  video.addEventListener('timeupdate',()=>{if(current()&&Number.isFinite(video.duration)&&video.duration>0)checkVideoProgress(video.currentTime/video.duration*100,video.currentTime);});
  video.addEventListener('play',()=>{if(!current())return;const d=videoState();if(!d.checkpointAnswered&&d.percent>=50)video.pause();});
  video.addEventListener('error',()=>{if(current())el('mediaStatus').textContent='تعذر تشغيل هذا الترميز. اختر فيديو آخر أو استخدم المحاكاة.';});
  video.addEventListener('waiting',()=>{if(current())el('mediaStatus').textContent='جارٍ تحميل الفيديو المحلي…';});
  video.addEventListener('canplay',()=>{if(current())el('mediaStatus').textContent='الفيديو المحلي جاهز للتشغيل.';});
  if(file)video.src=file.url;
  updateVideoUI();
}
function examPage() {
  const exam=repository.get('exams',state.examId);
  if(!exam)return recordsPage('exams');
  if(manager()&&state.preview)return section('معاينة '+exam.name,'<p>معاينة فقط؛ لا تُنشئ محاولة أو نتيجة طالب.</p>'+exam.questions.map((q,i)=>'<fieldset><legend>'+(i+1)+'. '+esc(q.text)+'</legend>'+q.options.map((o,j)=>'<p>'+esc(o)+(j===q.correct?' ✓':'')+'</p>').join('')+'</fieldset>').join('')+button('العودة للاختبارات','backExams'));
  const attempt=repository.getAttempt(exam.id);if(!attempt)return recordsPage('exams');
  if(attempt.status==='submitted')return section('نتيجة الاختبار','<h3>'+attempt.score+' من '+attempt.total+'</h3><p>'+Math.round(attempt.score/attempt.total*100)+'% — '+(attempt.reason==='timeout'?'انتهى الوقت وتم تسليم المحاولة تلقائياً.':'تم تسليم الاختبار.')+'</p><p class="muted">نتيجة تجريبية محفوظة على هذا المتصفح.</p>'+exam.questions.map(q=>'<article class="card"><h3>'+esc(q.text)+'</h3><p>إجابتك: '+esc(q.options[attempt.answers[q.id]]||'لم تتم الإجابة')+'</p><p>الإجابة الصحيحة: '+esc(q.options[q.correct])+'</p></article>').join('')+'<p class="controls">'+button('إعادة الاختبار','retake',exam.id)+button('العودة للاختبارات','backExams')+'</p>');
  const index=Math.min(attempt.current,exam.questions.length-1),q=exam.questions[index];
  const review=state.examReview?'<div id="examReview" class="panel"><h3>مراجعة الإجابات</h3>'+exam.questions.map((x,i)=>'<p>'+button('السؤال '+(i+1)+' — '+(Object.hasOwn(attempt.answers,x.id)?x.options[attempt.answers[x.id]]:'بلا إجابة')+(attempt.review.includes(x.id)?' — للمراجعة':''),'examQuestion',String(i))+'</p>').join('')+'</div>':'';
  return section(exam.name,'<p id="examTimer" role="timer" aria-live="off"></p><p>السؤال '+(index+1)+' من '+exam.questions.length+'</p><fieldset id="question"><legend>'+esc(q.text)+'</legend>'+q.options.map((o,j)=>'<label><input type="radio" name="answer" value="'+j+'" '+(attempt.answers[q.id]===j?'checked':'')+'> '+esc(o)+'</label>').join('')+'</fieldset><label><input id="markReview" type="checkbox" '+(attempt.review.includes(q.id)?'checked':'')+'> وضع علامة للمراجعة</label><div class="controls">'+button('السابق','examQuestion',String(index-1),index===0?'disabled':'')+button('التالي','examQuestion',String(index+1),index===exam.questions.length-1?'disabled':'')+button('مراجعة الإجابات','examReview')+button('إرسال الاختبار','submitExam')+'</div>'+review);
}
function tickExam() {
  if(!el('examTimer'))return;
  const attempt=repository.getAttempt(state.examId);if(!attempt)return;
  if(attempt.status==='submitted'){if(el('dialog').open)el('dialog').close();render();notify('انتهى وقت الاختبار؛ تم حفظ النتيجة.');return;}
  const seconds=Math.max(0,Math.ceil((attempt.deadline-Date.now())/1000));el('examTimer').textContent='الوقت المتبقي: '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
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
function render() {
  const oldVideo=el('lessonVideo');if(oldVideo){oldVideo.pause();oldVideo.removeAttribute('src');oldVideo.load();}
  clearInterval(examInterval);el('role').value=state.role;document.body.dataset.experience=manager()?'formal':'learning';
  const entering=['welcome','login','register'].includes(state.page);document.body.dataset.entry=String(entering);document.body.dataset.view=state.page;
  el('nav').innerHTML=entering?'':menus[state.role].map(([id,label])=>'<button type="button" data-page="'+id+'" class="'+(state.page===id?'active':'')+'" '+(state.page===id?'aria-current="page"':'')+'>'+icon(id)+esc(label)+'</button>').join('');
  el('content').setAttribute('aria-busy','true');
  const pages={welcome,login:account,register:account,home,results:resultsPage,children:parentPage,attendance:parentPage,messages:messagesPage,notifications:notificationsPage,profile:profilePage,ai:()=>section('توصيات تعليمية تجريبية','<p>اقتراح محلي دون اتصال بذكاء اصطناعي: اختر درساً لم تكمله.</p><div class="grid">'+repository.list('lessons').filter(l=>repository.getLessonState(l.id).percent<100).map(l=>card(l.name,'<p>'+esc(l.detail)+'</p>',button('فتح الدرس','openVideo',l.id))).join('')+'</div>')};
  let html;
  if(state.page==='video')html=manager()&&!state.preview?recordsPage('lessons'):videoPage();
  else if(state.page==='exams')html=state.examOpen||state.preview?examPage():recordsPage('exams');
  else html=pages[state.page]?pages[state.page]():recordsPage(state.page);
  el('content').innerHTML=html;el('content').setAttribute('aria-busy','false');
  if(el('lessonVideo'))bindVideo();
  if(el('examTimer')){tickExam();examInterval=setInterval(tickExam,500);}
  storageNotice();
}
function enter() {repository.setSetting('entered',true);go('home');}
const actions={
  guestBanner:enter,discover:id=>{state.role='student';repository.setSetting('role','student');repository.setSetting('entered',true);actions.subjectLessons(id);},
  welcome:()=>go('welcome'),login:()=>go('login'),register:()=>go('register'),guest:enter,closeDialog:()=>el('dialog').close(),
  create:()=>editRecord(),edit:id=>editRecord(id),detail:details,delete:deleteRecord,
  subjectLessons:id=>{go('lessons');state.subject=id;el('subjectFilter').value=id;el('resultsList').innerHTML=recordList('lessons');},
  openVideo:id=>{state.lessonId=id;repository.setSetting('lessonId',id);go('video',manager());},
  openExam:id=>{state.examId=id;repository.setSetting('examId',id);repository.startAttempt(id);go('exams',false,true);},
  previewExam:id=>{state.examId=id;repository.setSetting('examId',id);go('exams',true);},
  backExams:()=>{state.examId='';go('exams');},retake:id=>{repository.startAttempt(id,Date.now(),true);state.examReview=false;render();},
  examQuestion:id=>{repository.saveAttempt(state.examId,{current:Number(id)});state.examReview=false;render();},
  examReview:()=>{state.examReview=!state.examReview;render();},
  submitExam:()=>{const a=repository.getAttempt(state.examId),exam=repository.get('exams',state.examId);if(a?.status!=='active')return render();const missing=exam.questions.length-Object.keys(a.answers).length;showDialog('تأكيد إرسال الاختبار','<p>أسئلة بلا إجابة: '+missing+'. يمكنك العودة للمراجعة أو إرسال المحاولة الآن.</p><p class="controls"><button class="btn" type="submit">تأكيد الإرسال</button>'+button('إلغاء','closeDialog')+'</p>',()=>{repository.submitAttempt(state.examId);el('dialog').close();render();notify('تم حفظ نتيجة الاختبار');});},
  advance:()=>{const d=videoState(),v=el('lessonVideo');checkVideoProgress(Math.min(100,d.percent+25),Number.isFinite(v.duration)?v.duration*Math.min(100,d.percent+25)/100:d.seconds);},
  resetVideo:()=>{el('lessonVideo').pause();el('lessonVideo').currentTime=0;saveVideoState({percent:0,seconds:0,checkpointAnswered:false});el('checkpointError').textContent='';updateVideoUI();},
  saveNotes:()=>{saveVideoState({notes:el('notes').value});notify('تم حفظ الملاحظات محلياً');},
  bookmark:()=>{saveVideoState({bookmark:el('lessonVideo').currentSrc?el('lessonVideo').currentTime:videoState().seconds});updateVideoUI();notify('تم حفظ العلامة المرجعية');},
  seekBookmark:()=>{const d=videoState();if(d.bookmark===null)return notify('احفظ علامة مرجعية أولاً');if(!el('lessonVideo').currentSrc)return notify('أعد اختيار الفيديو المحلي للانتقال إلى العلامة');el('lessonVideo').currentTime=Math.min(d.bookmark,el('lessonVideo').duration||d.bookmark);},
  checkpoint:id=>{const lesson=repository.get('lessons',state.lessonId);if(Number(id)!==lesson.checkpoint.correct){el('checkpointError').textContent='إجابة غير صحيحة؛ حاول مرة أخرى.';return;}saveVideoState({checkpointAnswered:true});updateVideoUI();notify('إجابة صحيحة؛ يمكنك متابعة الدرس');if(el('lessonVideo').currentSrc)el('lessonVideo').play().catch(()=>notify('اضغط تشغيل لمتابعة الفيديو'));else el('notes').focus();},
  fullscreen:async()=>{try{const v=el('lessonVideo');if(v.requestFullscreen)await v.requestFullscreen();else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();else notify('استخدم زر ملء الشاشة في أدوات المتصفح');}catch{notify('استخدم زر ملء الشاشة في أدوات الفيديو');}},
  assignment:id=>{const a=repository.get('assignments',id);showDialog(a.name,'<p>'+esc(a.detail)+'</p><label for="submission">إجابتي التجريبية</label><textarea id="submission" rows="4" required maxlength="5000">'+esc(assignmentSubmission(a,'u1'))+'</textarea><p class="controls"><button class="btn" type="submit">حفظ التسليم</button>'+button('إلغاء','closeDialog')+'</p>',()=>{const text=el('submission').value.trim();if(!text)throw new Error('اكتب إجابتك أولاً.');repository.save('assignments',{...a,submissions:{...(a.submissions||{}),u1:text}});el('dialog').close();render();notify('تم حفظ التسليم التجريبي');});},
  submissions:id=>{const a=repository.get('assignments',id),students=repository.list('students').filter(s=>assignmentSubmission(a,s.id));showDialog('تسليمات '+a.name,(students.length?students.map(s=>'<h3>'+esc(s.name)+'</h3><p>'+esc(assignmentSubmission(a,s.id))+'</p>').join(''):'<p>لا توجد تسليمات محلية لهذا الواجب.</p>')+button('إغلاق','closeDialog'));},
  readNotification:id=>{const n=repository.get('notifications',id);repository.save('notifications',{...n,status:'مقروء'});render();notify('تم تحديث الإشعار');},
  addQuestion:()=>{const container=el('questionEditors');if(container.children.length>=20)return;container.insertAdjacentHTML('beforeend',optionFields(null,container.children.length));},
  removeQuestion:(_,target)=>{const container=el('questionEditors');const values=[...container.children].map((node,i)=>readQuestion(node,i));values.splice([...container.children].indexOf(target.closest('fieldset')),1);container.innerHTML=values.map((q,i)=>optionFields(q,i)).join('');}
};
document.addEventListener('click',event=>{
  const route=event.target.closest('[data-page]');if(route)return go(route.dataset.page);
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  try{const result=actions[target.dataset.action]?.(target.dataset.id,target);if(result?.catch)result.catch(error=>notify(error.message));}catch(error){if(el('dialog').open)el('dialogError').textContent=error.message;else notify(error.message);}
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  try{
    if(event.target.id==='dialogForm'){dialogSubmit?.();return;}
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
el('dialog').addEventListener('close',()=>{dialogSubmit=null;if(dialogTrigger?.isConnected)dialogTrigger.focus();else el('main').focus();});
el('theme').addEventListener('click',()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');el('theme').setAttribute('aria-pressed',String(dark));repository.setSetting('theme',dark?'dark':'light');storageNotice();});
if(repository.getSetting('theme','light')==='dark'){document.body.classList.add('dark');el('theme').setAttribute('aria-pressed','true');}
window.addEventListener('beforeunload',()=>{for(const file of videoFiles.values())URL.revokeObjectURL(file.url);});
render();

