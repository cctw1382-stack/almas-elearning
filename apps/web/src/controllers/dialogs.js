// Owns modal state, record editing and focus restoration.
export function createDialogs({ repository, el, esc, button, pageKind, manager, render, notify, document }) {
let dialogSubmit = null, dialogTrigger = null;
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

el('dialog').addEventListener('close',()=>{dialogSubmit=null;if(dialogTrigger?.isConnected)dialogTrigger.focus();else el('main').focus();});
return { showDialog, field, optionFields, readQuestion, editRecord, details, deleteRecord, submitDialog: () => dialogSubmit?.() };
}
