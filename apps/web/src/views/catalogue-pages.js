// Rendering reads current application state; event handlers remain in the controller.
export function createCataloguePages({ repository, state, child, childPicker, el, esc, icon, brandMark, section, subjectTiles, card, recordStatus, manager, button, assignmentSubmission, subjectArt, table, titles }) {
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

return { home, recordList, recordsPage };
}
