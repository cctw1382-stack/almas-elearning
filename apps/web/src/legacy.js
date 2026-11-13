import { bindApplicationEvents } from "./controllers/events.js";
import { createDialogs } from "./controllers/dialogs.js";
import { createLearningPages } from "./views/learning-pages.js";
import { createCataloguePages } from "./views/catalogue-pages.js";
import { createCommunityPages } from "./views/community-pages.js";
import { createPublicPages } from "./views/public-pages.js";
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
let examInterval = null;
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
const { welcome, account, subjectTiles, icon, brandMark, subjectArt } = createPublicPages({ repository, state, button, section, esc, document });
const { home, recordList, recordsPage } = createCataloguePages({ repository, state, child, childPicker, el, esc, icon, brandMark, section, subjectTiles, card, recordStatus, manager, button, assignmentSubmission, subjectArt, table, titles });
const { videoPage, examPage } = createLearningPages({ repository, state, section, esc, button, manager, recordsPage });
const { showDialog, field, optionFields, readQuestion, editRecord, details, deleteRecord, submitDialog } = createDialogs({ repository, el, esc, button, pageKind, manager, render, notify, document });
function videoState() { return repository.getLessonState(state.lessonId,manager()?state.role:'student'); }
function saveVideoState(patch) { return repository.saveLessonState(state.lessonId,patch,manager()?state.role:'student'); }
function updateVideoUI() {
  const data=videoState();el('videoPercent').textContent=data.percent+'%';el('videoProgress').setAttribute('aria-valuenow',data.percent);el('videoProgress').firstElementChild.style.width=data.percent+'%';
  el('bookmarkStatus').textContent=data.bookmark===null?'لا توجد علامة مرجعية.':'علامة مرجعية عند '+Math.floor(data.bookmark)+' ثانية.';
  storageNotice();
}
function checkVideoProgress(percent,seconds) {
  saveVideoState({percent:Math.max(0,Math.min(100,Math.floor(percent))),seconds:Math.max(0,seconds)});
  updateVideoUI();
}
function bindVideo() {
  const video=el('lessonVideo'),file=videoFiles.get(state.lessonId);
  const current=()=>video.isConnected&&el('lessonVideo')===video;
  video.addEventListener('loadedmetadata',()=>{if(!current())return;const data=videoState();video.currentTime=Math.min(data.seconds,Number.isFinite(video.duration)?video.duration:0);el('mediaStatus').textContent='الفيديو المحلي جاهز؛ استُعيد موضع المشاهدة.';});
  video.addEventListener('timeupdate',()=>{if(current()&&Number.isFinite(video.duration)&&video.duration>0)checkVideoProgress(video.currentTime/video.duration*100,video.currentTime);});
  video.addEventListener('error',()=>{if(current())el('mediaStatus').textContent='تعذر تشغيل هذا الترميز. اختر فيديو آخر أو استخدم المحاكاة.';});
  video.addEventListener('waiting',()=>{if(current())el('mediaStatus').textContent='جارٍ تحميل الفيديو المحلي…';});
  video.addEventListener('canplay',()=>{if(current())el('mediaStatus').textContent='الفيديو المحلي جاهز للتشغيل.';});
  if(file)video.src=file.url;
  updateVideoUI();
}
function tickExam() {
  if(!el('examTimer'))return;
  const attempt=repository.getAttempt(state.examId);if(!attempt)return;
  if(attempt.status==='submitted'){if(el('dialog').open)el('dialog').close();render();notify('انتهى وقت الاختبار؛ تم حفظ النتيجة.');return;}
  const seconds=Math.max(0,Math.ceil((attempt.deadline-Date.now())/1000));el('examTimer').textContent='الوقت المتبقي: '+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
const { parentPage, resultsPage, messagesPage, notificationsPage, profilePage } = createCommunityPages({ repository, state, child, childPicker, esc, section, table, progressBar, manager, card, button, field });
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
  resetVideo:()=>{el('lessonVideo').pause();el('lessonVideo').currentTime=0;saveVideoState({percent:0,seconds:0,checkpointAnswered:false});updateVideoUI();},
  saveNotes:()=>{saveVideoState({notes:el('notes').value});notify('تم حفظ الملاحظات محلياً');},
  bookmark:()=>{saveVideoState({bookmark:el('lessonVideo').currentSrc?el('lessonVideo').currentTime:videoState().seconds});updateVideoUI();notify('تم حفظ العلامة المرجعية');},
  seekBookmark:()=>{const d=videoState();if(d.bookmark===null)return notify('احفظ علامة مرجعية أولاً');if(!el('lessonVideo').currentSrc)return notify('أعد اختيار الفيديو المحلي للانتقال إلى العلامة');el('lessonVideo').currentTime=Math.min(d.bookmark,el('lessonVideo').duration||d.bookmark);},
  fullscreen:async()=>{try{const v=el('lessonVideo');if(v.requestFullscreen)await v.requestFullscreen();else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();else notify('استخدم زر ملء الشاشة في أدوات المتصفح');}catch{notify('استخدم زر ملء الشاشة في أدوات الفيديو');}},
  assignment:id=>{const a=repository.get('assignments',id);showDialog(a.name,'<p>'+esc(a.detail)+'</p><label for="submission">إجابتي التجريبية</label><textarea id="submission" rows="4" required maxlength="5000">'+esc(assignmentSubmission(a,'u1'))+'</textarea><p class="controls"><button class="btn" type="submit">حفظ التسليم</button>'+button('إلغاء','closeDialog')+'</p>',()=>{const text=el('submission').value.trim();if(!text)throw new Error('اكتب إجابتك أولاً.');repository.save('assignments',{...a,submissions:{...(a.submissions||{}),u1:text}});el('dialog').close();render();notify('تم حفظ التسليم التجريبي');});},
  submissions:id=>{const a=repository.get('assignments',id),students=repository.list('students').filter(s=>assignmentSubmission(a,s.id));showDialog('تسليمات '+a.name,(students.length?students.map(s=>'<h3>'+esc(s.name)+'</h3><p>'+esc(assignmentSubmission(a,s.id))+'</p>').join(''):'<p>لا توجد تسليمات محلية لهذا الواجب.</p>')+button('إغلاق','closeDialog'));},
  readNotification:id=>{const n=repository.get('notifications',id);repository.save('notifications',{...n,status:'مقروء'});render();notify('تم تحديث الإشعار');},
  addQuestion:()=>{const container=el('questionEditors');if(container.children.length>=20)return;container.insertAdjacentHTML('beforeend',optionFields(null,container.children.length));},
  removeQuestion:(_,target)=>{const container=el('questionEditors');const values=[...container.children].map((node,i)=>readQuestion(node,i));values.splice([...container.children].indexOf(target.closest('fieldset')),1);container.innerHTML=values.map((q,i)=>optionFields(q,i)).join('');}
};
bindApplicationEvents({ document, window, repository, state, actions, go, el, notify, submitDialog, enter, render, recordList, pageKind, videoFiles, storageNotice });
render();

