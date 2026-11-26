'use strict';
(async function(){
  const params=new URLSearchParams(location.search);
  const view=params.get('view')||'population';
  const tabs=Array.from(document.querySelectorAll('[data-tab]'));
  const tab=tabs.find(link=>link.dataset.tab===view);
  if(tab){tab.setAttribute('aria-current','page');document.title=tab.textContent+' · Prezto 用户画像';}
  if(view==='population')return;
  const main=document.querySelector('#panel');
  document.querySelector('#population').hidden=true;
  main.hidden=false;
  main.textContent='正在加载…';
  const load=async name=>{
    const response=await fetch(name+'.json');
    if(!response.ok)throw new Error('加载失败');
    return response.json();
  };
  try {
    if(view==='actions'||view==='sources'){
      const tmpl=document.getElementById(view==='actions'?'actionCards':'sourceTable');
      main.replaceChildren(tmpl.content.cloneNode(true));
    }else if(['content','overview','work'].includes(view)){
      window.renderPublicWork(main,view,await load('work'),params);
    }else if(tab||view==='profile'){
      const [people,work]=await Promise.all([load('people'),view==='profile'?load('work'):null]);
      window.renderPublicPeople(main,view,people,params,work);
    }else{
      main.innerHTML='<h1>页面不存在</h1><a href="?view=population">返回用户大盘</a>';
    }
  }catch{
    main.innerHTML='<h1>页面未能加载</h1><p>请刷新页面重试。</p><a href="?view=population">返回用户大盘</a>';
  }
})();
