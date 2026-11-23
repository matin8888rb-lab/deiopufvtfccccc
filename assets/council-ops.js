/* COUNCIL HQ — cloud-backed operations module.
   Loaded after the main page script; relies on its Supabase client and workspace bootstrap. */
let opsTasks=[],opsDeps=[],opsMeetings=[],opsParticipants=[],opsDecisions=[],opsEvidence=[],opsAudit=[],opsMembers=[];
window.opsTasks=opsTasks;window.opsDeps=opsDeps;window.opsMeetings=opsMeetings;window.opsParticipants=opsParticipants;window.opsDecisions=opsDecisions;window.opsEvidence=opsEvidence;
function hqRestoreOpsLocal(saved){
  if(!saved)return;
  opsTasks=Array.isArray(saved.opsTasks)?saved.opsTasks:[];
  opsDeps=Array.isArray(saved.opsDeps)?saved.opsDeps:[];
  opsMeetings=Array.isArray(saved.opsMeetings)?saved.opsMeetings:[];
  opsParticipants=Array.isArray(saved.opsParticipants)?saved.opsParticipants:[];
  opsDecisions=Array.isArray(saved.opsDecisions)?saved.opsDecisions:[];
  opsEvidence=Array.isArray(saved.opsEvidence)?saved.opsEvidence:[];
  hqExposeOps();
}
function hqExposeOps(){
  window.opsTasks=opsTasks;window.opsDeps=opsDeps;window.opsMeetings=opsMeetings;
  window.opsParticipants=opsParticipants;window.opsDecisions=opsDecisions;window.opsEvidence=opsEvidence;
}
function hqTaskStatusLabel(s){return ({todo:'در انتظار',in_progress:'در حال انجام',review:'در بازبینی',blocked:'مسدود',done:'انجام‌شده',cancelled:'لغوشده'})[s]||'نامشخص';}
function hqMeetingStatusLabel(s){return ({scheduled:'برنامه‌ریزی‌شده',in_progress:'در حال برگزاری',completed:'پایان‌یافته',cancelled:'لغوشده'})[s]||'نامشخص';}
function hqDecisionStatusLabel(s){return ({under_review:'در حال بررسی',approved:'تصویب‌شده',rejected:'ردشده',deferred:'به تعویق افتاده',reopened:'بازگشایی‌شده'})[s]||'نامشخص';}
function hqHasDependencyCycle(taskId,dependencyId,deps){
  if(!taskId||!dependencyId||taskId===dependencyId)return true;
  const graph=new Map();
  (deps||[]).forEach(d=>{if(!graph.has(d.task_id))graph.set(d.task_id,[]);graph.get(d.task_id).push(d.depends_on_task_id);});
  const stack=[dependencyId],seen=new Set();
  while(stack.length){const current=stack.pop();if(current===taskId)return true;if(seen.has(current))continue;seen.add(current);(graph.get(current)||[]).forEach(next=>stack.push(next));}
  return false;
}
function hqEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function hqSafeUrl(v){try{const u=new URL(String(v||''));return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(e){return '';}}
function hqOpsUser(){if(!window.__hqSessionUser||!window.__hqWorkspaceId)throw new Error('ابتدا وارد فضای کاری شو.');return {user:window.__hqSessionUser,workspaceId:window.__hqWorkspaceId};}
function hqCacheOps(){
  hqExposeOps();
  try{localStorage.setItem(HQ_STORE_KEY,JSON.stringify({
    projects,logs,research,chatHistory:window.__hqChatHistory||[],chatRecords:window.__hqChatRecords||[],
    opsTasks,opsDeps,opsMeetings,opsParticipants,opsDecisions,opsEvidence
  }));}catch(e){console.warn('Operations cache unavailable',e);}
}
function hqMergeRows(remote,local,keyFn){
  const map=new Map((remote||[]).map(x=>[keyFn(x),x]));
  if(window.__hqHadLocalSnapshot)(local||[]).forEach(x=>{const k=keyFn(x);if(!map.has(k))map.set(k,x);});
  return [...map.values()];
}
async function hqLoadOpsData(){
  const {user,workspaceId}=hqOpsUser();
  const [t,d,m,p,dc,e,a,mem]=await Promise.all([
    sbClient.from('tasks').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
    sbClient.from('task_dependencies').select('*').eq('owner_id',user.id),
    sbClient.from('meetings').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
    sbClient.from('meeting_participants').select('*').eq('owner_id',user.id),
    sbClient.from('decisions').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}),
    sbClient.from('decision_evidence').select('*').eq('owner_id',user.id),
    sbClient.from('audit_events').select('*').eq('workspace_id',workspaceId).order('created_at',{ascending:false}).limit(30),
    sbClient.from('council_members').select('*').eq('workspace_id',workspaceId).eq('is_active',true).order('sort_order')
  ]);
  for(const r of [t,d,m,p,dc,e,a,mem])if(r.error)throw r.error;
  const remote={tasks:t.data||[],deps:d.data||[],meetings:m.data||[],participants:p.data||[],decisions:dc.data||[],evidence:e.data||[]};
  opsTasks=hqMergeRows(remote.tasks,opsTasks,x=>x.id);
  opsDeps=hqMergeRows(remote.deps,opsDeps,x=>x.task_id+':'+x.depends_on_task_id);
  opsMeetings=hqMergeRows(remote.meetings,opsMeetings,x=>x.id);
  opsParticipants=hqMergeRows(remote.participants,opsParticipants,x=>x.meeting_id+':'+x.member_id);
  opsDecisions=hqMergeRows(remote.decisions,opsDecisions,x=>x.id);
  opsEvidence=hqMergeRows(remote.evidence,opsEvidence,x=>x.id);
  opsAudit=a.data||[];opsMembers=mem.data||[];
  const pending=(r,l,k)=>{const keys=new Set((r||[]).map(k));return (l||[]).filter(x=>!keys.has(k(x)));};
  const writes=[];
  const pt=pending(remote.tasks,opsTasks,x=>x.id),pd=pending(remote.deps,opsDeps,x=>x.task_id+':'+x.depends_on_task_id);
  const pm=pending(remote.meetings,opsMeetings,x=>x.id),pp=pending(remote.participants,opsParticipants,x=>x.meeting_id+':'+x.member_id);
  const pdc=pending(remote.decisions,opsDecisions,x=>x.id),pe=pending(remote.evidence,opsEvidence,x=>x.id);
  if(pt.length)writes.push(sbClient.from('tasks').upsert(pt,{onConflict:'id'}));
  if(pd.length)writes.push(sbClient.from('task_dependencies').upsert(pd,{onConflict:'task_id,depends_on_task_id'}));
  if(pm.length)writes.push(sbClient.from('meetings').upsert(pm,{onConflict:'id'}));
  if(pp.length)writes.push(sbClient.from('meeting_participants').upsert(pp,{onConflict:'meeting_id,member_id'}));
  if(pdc.length)writes.push(sbClient.from('decisions').upsert(pdc,{onConflict:'id'}));
  if(pe.length)writes.push(sbClient.from('decision_evidence').upsert(pe,{onConflict:'id'}));
  const wr=await Promise.all(writes);for(const r of wr)if(r.error)throw r.error;
  hqCacheOps();hqRenderOps();
}
async function hqWriteAudit(eventType,entityType,entityId,details={}){
  const {user,workspaceId}=hqOpsUser();
  const {data,error}=await sbClient.from('audit_events').insert({
    workspace_id:workspaceId,owner_id:user.id,actor_type:'user',event_type:eventType,
    entity_type:entityType,entity_id:entityId||null,details
  }).select('*').single();
  if(error)throw error;
  opsAudit.unshift(data);opsAudit=opsAudit.slice(0,30);return data;
}
function hqRenderTaskOptions(){
  $('taskProject').innerHTML='<option value="">بدون پروژه</option>'+projects.map(p=>'<option value="'+hqEsc(p.id)+'">'+hqEsc(p.name)+'</option>').join('');
  $('taskAssignee').innerHTML='<option value="">تعیین نشده</option>'+opsMembers.map(m=>'<option value="'+hqEsc(m.id)+'">'+hqEsc(m.display_name)+'</option>').join('');
  $('taskDependency').innerHTML='<option value="">بدون وابستگی</option>'+opsTasks.filter(t=>!['done','cancelled'].includes(t.status)).map(t=>'<option value="'+hqEsc(t.id)+'">'+hqEsc(t.title)+'</option>').join('');
  $('meetingParticipants').innerHTML=opsMembers.map(m=>'<label><input type="checkbox" name="meetingMember" value="'+hqEsc(m.id)+'" checked> '+hqEsc(m.display_name)+'</label>').join('')||'<span class="subtle">اعضای شورا هنوز بارگذاری نشده‌اند.</span>';
  $('decisionMeeting').innerHTML='<option value="">بدون جلسه مرتبط</option>'+opsMeetings.map(m=>'<option value="'+hqEsc(m.id)+'">'+hqEsc(m.title)+'</option>').join('');
}
function hqRenderTasks(){
  const q=($('taskSearch')?.value||'').trim().toLocaleLowerCase();
  const rows=opsTasks.filter(t=>(t.title+' '+(t.description||'')).toLocaleLowerCase().includes(q));
  $('taskList').innerHTML=rows.length?rows.map(t=>{
    const assignee=opsMembers.find(m=>m.id===t.assignee_member_id),project=projects.find(p=>p.id===t.project_id);
    const deps=opsDeps.filter(d=>d.task_id===t.id).map(d=>opsTasks.find(x=>x.id===d.depends_on_task_id)?.title).filter(Boolean);
    const due=t.due_at?new Date(t.due_at).toLocaleString('fa-IR'):'بدون موعد';
    return '<article class="ops-item"><div class="ops-item-head"><div><h3>'+hqEsc(t.title)+'</h3><span class="subtle">'+hqEsc(t.description||'بدون توضیح')+'</span></div><span class="pill '+(t.status==='done'?'good':t.status==='blocked'?'warn':'')+'">'+hqTaskStatusLabel(t.status)+'</span></div><div class="ops-meta"><span class="ops-chip">مسئول: '+hqEsc(assignee?.display_name||'تعیین نشده')+'</span><span class="ops-chip">پروژه: '+hqEsc(project?.name||'بدون پروژه')+'</span><span class="ops-chip">اولویت: '+hqEsc(({low:'کم',normal:'عادی',high:'زیاد',critical:'بحرانی'})[t.priority]||'عادی')+'</span><span class="ops-chip">موعد: '+hqEsc(due)+'</span></div>'+(deps.length?'<p>وابسته به: '+hqEsc(deps.join('، '))+'</p>':'')+'<div class="ops-actions"><select data-task-status="'+hqEsc(t.id)+'" aria-label="تغییر وضعیت وظیفه"><option value="todo" '+(t.status==='todo'?'selected':'')+'>در انتظار</option><option value="in_progress" '+(t.status==='in_progress'?'selected':'')+'>در حال انجام</option><option value="review" '+(t.status==='review'?'selected':'')+'>در بازبینی</option><option value="blocked" '+(t.status==='blocked'?'selected':'')+'>مسدود</option><option value="done" '+(t.status==='done'?'selected':'')+'>انجام‌شده</option><option value="cancelled" '+(t.status==='cancelled'?'selected':'')+'>لغوشده</option></select><button type="button" class="danger" data-task-delete="'+hqEsc(t.id)+'">حذف</button></div></article>';
  }).join(''):'<div class="ops-empty">وظیفه‌ای با این عبارت پیدا نشد.</div>';
  const open=opsTasks.filter(t=>!['done','cancelled'].includes(t.status)).length,done=opsTasks.filter(t=>t.status==='done').length,blocked=opsTasks.filter(t=>t.status==='blocked').length;
  $('taskCount').textContent=open;$('taskTotal').textContent=opsTasks.length+' مورد';
  $('taskSummary').innerHTML='<div class="event"><div class="event-mark">◷</div><div><p>'+open+' وظیفه باز</p><small>در انتظار یا در حال پیگیری</small></div></div><div class="event"><div class="event-mark">✓</div><div><p>'+done+' وظیفه تکمیل‌شده</p><small>خروجی‌های ثبت‌شده</small></div></div><div class="event"><div class="event-mark">⚑</div><div><p>'+blocked+' وظیفه مسدود</p><small>نیازمند رفع مانع</small></div></div>';
  hqRenderTaskOptions();
}
function hqRenderMeetings(){
  $('meetingList').innerHTML=opsMeetings.length?opsMeetings.map(m=>{
    const names=opsParticipants.filter(p=>p.meeting_id===m.id).map(p=>opsMembers.find(x=>x.id===p.member_id)?.display_name).filter(Boolean);
    const actions=m.status==='scheduled'?'<button type="button" data-meeting-action="start" data-id="'+hqEsc(m.id)+'">شروع جلسه</button><button type="button" class="danger" data-meeting-action="cancel" data-id="'+hqEsc(m.id)+'">لغو</button>':m.status==='in_progress'?'<textarea class="ops-summary" data-meeting-summary="'+hqEsc(m.id)+'" placeholder="جمع‌بندی و خروجی جلسه...">'+hqEsc(m.summary||'')+'</textarea><div class="ops-actions"><button type="button" data-meeting-action="finish" data-id="'+hqEsc(m.id)+'">پایان و ثبت صورت‌جلسه</button></div>':'';
    return '<article class="ops-item"><div class="ops-item-head"><div><h3>'+hqEsc(m.title)+'</h3><span class="subtle">'+hqEsc(m.agenda||'بدون دستور جلسه')+'</span></div><span class="pill '+(m.status==='completed'?'good':m.status==='cancelled'?'warn':'')+'">'+hqMeetingStatusLabel(m.status)+'</span></div><div class="ops-meta"><span class="ops-chip">شرکت‌کنندگان: '+hqEsc(names.join('، ')||'ثبت نشده')+'</span><span class="ops-chip">ایجاد: '+hqEsc(new Date(m.created_at).toLocaleString('fa-IR'))+'</span></div>'+(m.summary&&m.status!=='in_progress'?'<p>'+hqEsc(m.summary)+'</p>':'')+'<div class="ops-actions">'+actions+'</div></article>';
  }).join(''):'<div class="ops-empty">هنوز جلسه‌ای ثبت نشده است.</div>';
  $('meetingTotal').textContent=opsMeetings.length+' جلسه';hqRenderTaskOptions();
}
function hqRenderDecisions(){
  $('decisionList').innerHTML=opsDecisions.length?opsDecisions.map(d=>{
    const meeting=opsMeetings.find(m=>m.id===d.meeting_id),evidence=opsEvidence.filter(e=>e.decision_id===d.id);
    return '<article class="ops-item"><div class="ops-item-head"><div><h3>'+hqEsc(d.title)+'</h3><span class="subtle">'+hqEsc(d.question)+'</span></div><span class="pill '+(d.status==='approved'?'good':d.status==='rejected'?'warn':'')+'">'+hqDecisionStatusLabel(d.status)+'</span></div><p>'+hqEsc(d.outcome||'هنوز نتیجه نهایی ثبت نشده است.')+'</p><div class="ops-meta"><span class="ops-chip">اطمینان: '+(d.confidence===null?'ثبت نشده':hqEsc(d.confidence)+'٪')+'</span><span class="ops-chip">جلسه: '+hqEsc(meeting?.title||'بدون جلسه')+'</span></div>'+(d.judge_summary?'<p><b>قاضی:</b> '+hqEsc(d.judge_summary)+'</p>':'')+(d.dissent_summary?'<p><b>مخالفت مستدل:</b> '+hqEsc(d.dissent_summary)+'</p>':'')+(d.reconsideration_conditions?'<p><b>شرایط بازنگری:</b> '+hqEsc(d.reconsideration_conditions)+'</p>':'')+(evidence.length?'<div class="ops-meta">'+evidence.map(e=>'<span class="ops-chip">'+hqEsc(e.claim)+' · '+hqEsc(({support:'پشتیبان',oppose:'مخالف',neutral:'خنثی'})[e.stance]||'خنثی')+(hqSafeUrl(e.source_url)?' · <a href="'+hqEsc(hqSafeUrl(e.source_url))+'" target="_blank" rel="noopener noreferrer">منبع</a>':'')+'</span>').join('')+'</div>':'')+'<div class="ops-actions"><select data-decision-status="'+hqEsc(d.id)+'" aria-label="تغییر وضعیت تصمیم"><option value="under_review" '+(d.status==='under_review'?'selected':'')+'>در حال بررسی</option><option value="approved" '+(d.status==='approved'?'selected':'')+'>تصویب</option><option value="rejected" '+(d.status==='rejected'?'selected':'')+'>رد</option><option value="deferred" '+(d.status==='deferred'?'selected':'')+'>تعویق</option><option value="reopened" '+(d.status==='reopened'?'selected':'')+'>بازگشایی</option></select></div></article>';
  }).join(''):'<div class="ops-empty">هنوز تصمیمی ثبت نشده است.</div>';
  $('decisionCount').textContent=opsDecisions.filter(d=>['under_review','reopened'].includes(d.status)).length;
  $('decisionTotal').textContent=opsDecisions.length+' تصمیم';
  const auditHtml=opsAudit.slice(0,12).map(a=>'<div class="ops-audit-item"><b>'+hqEsc(({'task.created':'وظیفه ایجاد شد','task.status_changed':'وضعیت وظیفه تغییر کرد','task.deleted':'وظیفه حذف شد','meeting.created':'جلسه ایجاد شد','meeting.started':'جلسه شروع شد','meeting.completed':'جلسه پایان یافت','meeting.cancelled':'جلسه لغو شد','decision.created':'تصمیم ثبت شد','decision.status_changed':'وضعیت تصمیم تغییر کرد'})[a.event_type]||a.event_type)+'</b><div class="subtle">'+hqEsc(a.details?.title||a.entity_type||'رویداد شورا')+'</div><small>'+hqEsc(new Date(a.created_at).toLocaleString('fa-IR'))+'</small></div>').join('');
  $('opsAuditList').innerHTML=auditHtml||'<div class="ops-empty">هنوز رویدادی ثبت نشده است.</div>';
  $('activityFeed').innerHTML=opsAudit.length?opsAudit.slice(0,6).map(a=>'<div class="event"><div class="event-mark">◈</div><div><p>'+hqEsc(a.details?.title||a.entity_type||'فعالیت شورا')+'</p><small>'+hqEsc(({'task.created':'وظیفه ایجاد شد','task.status_changed':'تغییر وضعیت وظیفه','task.deleted':'حذف وظیفه','meeting.created':'جلسه ایجاد شد','meeting.started':'جلسه شروع شد','meeting.completed':'جلسه پایان یافت','meeting.cancelled':'جلسه لغو شد','decision.created':'تصمیم ثبت شد','decision.status_changed':'تغییر وضعیت تصمیم'})[a.event_type]||a.event_type)+' · '+hqEsc(new Date(a.created_at).toLocaleString('fa-IR'))+'</small></div></div>').join(''):'<div class="ops-empty">فعالیت ثبت‌شده‌ای وجود ندارد.</div>';
}
function hqRenderOps(){hqRenderTasks();hqRenderMeetings();hqRenderDecisions();hqRenderTaskOptions();}
function hqOpsError(err){console.error('Council operations:',err);toast('عملیات انجام نشد: '+(err?.message||'خطای ارتباط با پایگاه داده'));}
$('taskForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const {user,workspaceId}=hqOpsUser(),title=$('taskTitle').value.trim(),depId=$('taskDependency').value;
    const row={workspace_id:workspaceId,owner_id:user.id,title,description:$('taskDescription').value.trim(),project_id:$('taskProject').value||null,assignee_member_id:$('taskAssignee').value||null,priority:$('taskPriority').value,status:'todo',due_at:$('taskDue').value?new Date($('taskDue').value).toISOString():null};
    const {data,error}=await sbClient.from('tasks').insert(row).select('*').single();if(error)throw error;
    let dep=null;
    if(depId){
      if(hqHasDependencyCycle(data.id,depId,opsDeps)){await sbClient.from('tasks').delete().eq('id',data.id);throw new Error('این وابستگی چرخه ایجاد می‌کند.');}
      const ins=await sbClient.from('task_dependencies').insert({task_id:data.id,depends_on_task_id:depId,owner_id:user.id}).select('*').single();
      if(ins.error){await sbClient.from('tasks').delete().eq('id',data.id);throw ins.error;}dep=ins.data;
    }
    opsTasks.unshift(data);if(dep)opsDeps.push(dep);
    try{await hqWriteAudit('task.created','task',data.id,{title:data.title,status:data.status});}catch(ae){toast('وظیفه ذخیره شد؛ اما ثبت رویداد تاریخچه خطا داشت.');}
    hqCacheOps();hqRenderOps();e.target.reset();toast('وظیفه در فضای کاری ذخیره شد.');
  }catch(err){hqOpsError(err);}
});
$('taskList').addEventListener('change',async e=>{
  const id=e.target.dataset.taskStatus,status=e.target.value;if(!id)return;
  try{
    if(status==='done'&&opsDeps.filter(d=>d.task_id===id).some(d=>{const dep=opsTasks.find(t=>t.id===d.depends_on_task_id);return dep&&dep.status!=='done';}))throw new Error('ابتدا وظایف پیش‌نیاز باید تکمیل شوند.');
    const {user}=hqOpsUser(),old=opsTasks.find(t=>t.id===id),from=old?.status;
    const {data,error}=await sbClient.from('tasks').update({status}).eq('id',id).eq('owner_id',user.id).select('*').single();if(error)throw error;
    Object.assign(old,data);
    try{await hqWriteAudit('task.status_changed','task',id,{title:data.title,from,to:status});}catch(ae){toast('وضعیت ذخیره شد؛ تاریخچه ثبت نشد.');}
    hqCacheOps();hqRenderOps();
  }catch(err){hqOpsError(err);hqRenderOps();}
});
$('taskList').addEventListener('click',async e=>{
  const id=e.target.dataset.taskDelete;if(!id)return;
  if(!confirm('این وظیفه و پیوندهای وابستگی آن حذف شوند؟'))return;
  try{
    const {user}=hqOpsUser();
    let r=await sbClient.from('task_dependencies').delete().eq('task_id',id).eq('owner_id',user.id);if(r.error)throw r.error;
    r=await sbClient.from('task_dependencies').delete().eq('depends_on_task_id',id).eq('owner_id',user.id);if(r.error)throw r.error;
    r=await sbClient.from('tasks').delete().eq('id',id).eq('owner_id',user.id);if(r.error)throw r.error;
    const old=opsTasks.find(t=>t.id===id);opsTasks=opsTasks.filter(t=>t.id!==id);opsDeps=opsDeps.filter(d=>d.task_id!==id&&d.depends_on_task_id!==id);
    try{await hqWriteAudit('task.deleted','task',id,{title:old?.title||'وظیفه'});}catch(ae){toast('وظیفه حذف شد؛ اما تاریخچه ثبت نشد.');}
    hqCacheOps();hqRenderOps();toast('وظیفه حذف شد.');
  }catch(err){hqOpsError(err);}
});
$('taskSearch').addEventListener('input',hqRenderTasks);
$('meetingForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const {user,workspaceId}=hqOpsUser(),row={workspace_id:workspaceId,owner_id:user.id,title:$('meetingTitle').value.trim(),agenda:$('meetingAgenda').value.trim(),status:'scheduled'};
    const {data,error}=await sbClient.from('meetings').insert(row).select('*').single();if(error)throw error;
    const selected=[...document.querySelectorAll('input[name="meetingMember"]:checked')].map(x=>x.value);
    if(selected.length){
      const ins=await sbClient.from('meeting_participants').insert(selected.map(member_id=>({meeting_id:data.id,member_id,owner_id:user.id})));
      if(ins.error){await sbClient.from('meetings').delete().eq('id',data.id);throw ins.error;}
    }
    opsMeetings.unshift(data);opsParticipants.push(...selected.map(member_id=>({meeting_id:data.id,member_id,owner_id:user.id,participation_role:'member'})));
    try{await hqWriteAudit('meeting.created','meeting',data.id,{title:data.title,participants:selected.length});}catch(ae){toast('جلسه ذخیره شد؛ تاریخچه ثبت نشد.');}
    hqCacheOps();hqRenderOps();e.target.reset();hqRenderTaskOptions();toast('جلسه ایجاد شد.');
  }catch(err){hqOpsError(err);}
});
$('meetingList').addEventListener('click',async e=>{
  const action=e.target.dataset.meetingAction,id=e.target.dataset.id;if(!action||!id)return;
  try{
    const {user}=hqOpsUser(),row=opsMeetings.find(m=>m.id===id);let patch={},eventType='';
    if(action==='start'){patch={status:'in_progress',started_at:new Date().toISOString()};eventType='meeting.started';}
    if(action==='finish'){const summary=$('meetingList').querySelector('[data-meeting-summary="'+id+'"]')?.value.trim()||'';if(!summary)throw new Error('برای پایان جلسه، خلاصه جلسه را ثبت کن.');patch={status:'completed',ended_at:new Date().toISOString(),summary};eventType='meeting.completed';}
    if(action==='cancel'){if(!confirm('این جلسه لغو شود؟'))return;patch={status:'cancelled',ended_at:new Date().toISOString()};eventType='meeting.cancelled';}
    const {data,error}=await sbClient.from('meetings').update(patch).eq('id',id).eq('owner_id',user.id).select('*').single();if(error)throw error;
    Object.assign(row,data);
    try{await hqWriteAudit(eventType,'meeting',id,{title:data.title,status:data.status});}catch(ae){toast('وضعیت جلسه ذخیره شد؛ تاریخچه ثبت نشد.');}
    hqCacheOps();hqRenderOps();toast('وضعیت جلسه به‌روزرسانی شد.');
  }catch(err){hqOpsError(err);}
});
$('decisionForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const {user,workspaceId}=hqOpsUser(),confidence=$('decisionConfidence').value;
    const row={workspace_id:workspaceId,owner_id:user.id,meeting_id:$('decisionMeeting').value||null,title:$('decisionTitle').value.trim(),question:$('decisionQuestion').value.trim(),outcome:$('decisionOutcome').value.trim(),status:'under_review',confidence:confidence===''?null:Number(confidence),judge_summary:$('decisionJudge').value.trim(),dissent_summary:$('decisionDissent').value.trim(),reconsideration_conditions:$('decisionReconsider').value.trim()};
    const {data,error}=await sbClient.from('decisions').insert(row).select('*').single();if(error)throw error;
    const claim=$('evidenceClaim').value.trim();let evidence=null;
    if(claim){
      const ev={decision_id:data.id,owner_id:user.id,claim,evidence_type:$('evidenceType').value,stance:$('evidenceStance').value,source_url:$('evidenceUrl').value.trim()||null,rationale:$('evidenceRationale').value.trim()};
      const ins=await sbClient.from('decision_evidence').insert(ev).select('*').single();
      if(ins.error){await sbClient.from('decisions').delete().eq('id',data.id);throw ins.error;}evidence=ins.data;
    }
    opsDecisions.unshift(data);if(evidence)opsEvidence.unshift(evidence);
    try{await hqWriteAudit('decision.created','decision',data.id,{title:data.title,status:data.status});}catch(ae){toast('تصمیم ذخیره شد؛ تاریخچه ثبت نشد.');}
    hqCacheOps();hqRenderOps();e.target.reset();toast('تصمیم در دفتر تصمیم‌ها ثبت شد.');
  }catch(err){hqOpsError(err);}
});
$('decisionList').addEventListener('change',async e=>{
  const id=e.target.dataset.decisionStatus,status=e.target.value;if(!id)return;
  try{
    const {user}=hqOpsUser(),row=opsDecisions.find(d=>d.id===id),from=row.status;
    const {data,error}=await sbClient.from('decisions').update({status}).eq('id',id).eq('owner_id',user.id).select('*').single();if(error)throw error;
    Object.assign(row,data);
    try{await hqWriteAudit('decision.status_changed','decision',id,{title:data.title,from,to:status});}catch(ae){toast('وضعیت تصمیم ذخیره شد؛ تاریخچه ثبت نشد.');}
    hqCacheOps();hqRenderOps();toast('وضعیت تصمیم تغییر کرد.');
  }catch(err){hqOpsError(err);hqRenderOps();}
});
