(function(){
  try {
    var SUPA_URL = "https://wxphtsgezburjqoqiqqo.supabase.co";
    var PROJECT_ID = "441ba0d4-daba-4d0d-b995-50bfa773fcf3";
    var ANON_KEY = "sb_publishable_mT5mfnCb12_k2uaMKyBd0w_7HZJ1aEI";
    if(!SUPA_URL||!PROJECT_ID||!ANON_KEY) return;
    var sid = sessionStorage.getItem("_aib_sid");
    if(!sid){ sid = Math.random().toString(36).slice(2)+Date.now().toString(36); sessionStorage.setItem("_aib_sid",sid); }
    var ua = navigator.userAgent;
    var device = /Mobi|Android|iPhone/i.test(ua) ? "mobile" : (/iPad|Tablet/i.test(ua)?"tablet":"desktop");
    var os = (function(){if(/Windows/.test(ua))return"Windows";if(/Mac/.test(ua))return"macOS";if(/Linux/.test(ua))return"Linux";if(/Android/.test(ua))return"Android";if(/iPhone|iPad/.test(ua))return"iOS";return"Unknown"})();
    var browser = (function(){if(/Edg/.test(ua))return"Edge";if(/Chrome/.test(ua))return"Chrome";if(/Safari/.test(ua))return"Safari";if(/Firefox/.test(ua))return"Firefox";return"Other"})();
    function send(){
      try {
        fetch(SUPA_URL+"/rest/v1/site_analytics",{
          method:"POST", keepalive:true,
          headers:{"Content-Type":"application/json","apikey":ANON_KEY,"Authorization":"Bearer "+ANON_KEY,"Prefer":"return=minimal"},
          body: JSON.stringify({project_id:PROJECT_ID,session_id:sid,page_path:location.pathname,device_type:device,os:os,browser:browser,referrer:document.referrer||null,user_agent:ua})
        });
      } catch(e){}
    }
    send();
    var lastPath=location.pathname;
    setInterval(function(){if(location.pathname!==lastPath){lastPath=location.pathname;send();}},1000);
  } catch(e){}
})();
