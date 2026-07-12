import { NextResponse } from "next/server";

const SCRIPT = `(function(){
  var s=document.currentScript;
  if(!s) return;
  var org=s.getAttribute("data-org");
  var campaign=s.getAttribute("data-campaign")||"";
  var source=s.getAttribute("data-source")||"embed";
  if(!org){console.error("Vital8 embed: data-org obrigatório");return;}
  var host=s.src.replace(/\\/embed\\/lead-form\\.js.*$/,"");
  var params=new URLSearchParams(window.location.search);
  function utm(k,d){return params.get(k)||d||"";}
  var wrap=document.createElement("div");
  wrap.id="vital8-lead-form";
  s.parentNode.insertBefore(wrap,s.nextSibling);
  var form=document.createElement("form");
  form.innerHTML='<input name="fullName" placeholder="Nome" required style="display:block;width:100%;margin:8px 0;padding:8px"/>'+
    '<input name="phone" placeholder="Telefone" required style="display:block;width:100%;margin:8px 0;padding:8px"/>'+
    '<input name="email" placeholder="E-mail" style="display:block;width:100%;margin:8px 0;padding:8px"/>'+
    '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px"/>'+
    '<label style="display:block;font-size:13px;margin:8px 0"><input type="checkbox" name="consent" required/> Aceito receber comunicações de marketing</label>'+
    '<label style="display:block;font-size:13px;margin:8px 0"><input type="checkbox" name="privacy" required/> Li a política de privacidade</label>'+
    '<button type="submit" style="padding:10px 16px;background:#2563eb;color:#fff;border:0;border-radius:6px">Enviar</button>'+
    '<p id="v8-msg" style="font-size:13px;margin-top:8px"></p>';
  wrap.appendChild(form);
  form.addEventListener("submit",function(e){
    e.preventDefault();
    if(form.website.value)return;
    if(!form.consent.checked||!form.privacy.checked){
      form.querySelector("#v8-msg").textContent="Consentimento obrigatório.";
      return;
    }
    fetch(host+"/api/public/leads",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        orgSlug:org,
        fullName:form.fullName.value,
        phone:form.phone.value,
        email:form.email.value||undefined,
        marketingConsent:true,
        privacyPolicyAccepted:true,
        honeypot:form.website.value,
        utmSource:utm("utm_source",source),
        utmMedium:utm("utm_medium","embed"),
        utmCampaign:utm("utm_campaign",campaign),
        utmTerm:utm("utm_term",""),
        utmContent:utm("utm_content","")
      })
    }).then(function(r){return r.json();}).then(function(res){
      form.querySelector("#v8-msg").textContent=res.success?"Obrigado! Entraremos em contato.":(res.error||"Erro");
    }).catch(function(){form.querySelector("#v8-msg").textContent="Erro de rede.";});
  });
})();`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
