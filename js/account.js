(()=>{
  const config=window.SUPABASE_CONFIG||window.SIRIONI_SUPABASE_CONFIG;
  const configured=config?.url&&!config.url.includes("TU-PROYECTO")&&config?.anonKey&&!config.anonKey.includes("TU_CLAVE_PUBLICA");
  const client=configured&&window.supabase?.createClient
    ?window.supabase.createClient(config.url,config.anonKey,{
      auth:{persistSession:true,autoRefreshToken:true}
    })
    :null;
  const accountForm=document.getElementById("account-form");
  const accountAccess=document.getElementById("account-access");
  const accountModal=document.getElementById("account-modal");
  const accountSubtitle=document.getElementById("account-subtitle");
  const entryModal=document.getElementById("entry-modal");
  const profileMenu=document.getElementById("profile-menu");
  const profileName=document.getElementById("profile-name");
  const profileEmail=document.getElementById("profile-email");
  accountModal.addEventListener("click",event=>{
    if(event.target===accountModal||event.target.classList.contains("modal-backdrop")){
      event.stopImmediatePropagation();
    }
  },true);
  const accountState={client,user:null,profile:null};
  window.sirioniAccount=accountState;
  window.sirioniUserRole=null;
  const notifyAuthChange=()=>window.dispatchEvent(new Event("sirioni:auth-change"));
  const toast=(message)=>{
    const node=document.getElementById("toast");
    node.textContent=message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>node.classList.remove("show"),4500);
  };
  const closeModal=()=>{
    accountModal.classList.add("hidden");
    accountModal.setAttribute("aria-hidden","true");
    document.body.style.overflow="";
  };
  const closeEntryModal=()=>{
    entryModal.classList.add("hidden");
    entryModal.setAttribute("aria-hidden","true");
    document.body.style.overflow="";
  };
  const openEntryModal=()=>{
    entryModal.classList.remove("hidden");
    entryModal.setAttribute("aria-hidden","false");
    document.body.style.overflow="hidden";
  };
  const syncAccountForm=(mode)=>{
    const isSignup=mode==="signup";
    const firstNameField=accountForm.querySelector('[data-field="firstName"]');
    const lastNameField=accountForm.querySelector('[data-field="lastName"]');
    const passwordField=accountForm.querySelector('[data-field="password"]');
    const passwordInput=passwordField.querySelector("input");
    const footer=accountModal.querySelector(".modal-footer");
    accountForm.dataset.mode=mode;
    firstNameField.style.display=isSignup?"grid":"none";
    lastNameField.style.display=isSignup?"grid":"none";
    passwordField.style.display=isSignup?"none":"grid";
    firstNameField.querySelector("input").required=isSignup;
    lastNameField.querySelector("input").required=isSignup;
    passwordInput.required=!isSignup;
    accountSubtitle.hidden=!isSignup;
    accountModal.querySelector("#account-title").textContent=isSignup?"Pedir acceso institucional":"Iniciar sesión";
    accountForm.querySelector('[type="submit"]').textContent=isSignup?"Pedir acceso institucional":"Ingresar";
    footer.innerHTML=isSignup
      ?'¿Ya tenés cuenta? <button type="button" class="text-button" data-switch="signin">Ingresar</button>'
      :'¿Necesitás acceso institucional? <button type="button" class="text-button" data-switch="signup">Solicitar acceso</button>';
    footer.querySelector(".text-button").addEventListener("click",event=>{
      syncAccountForm(event.currentTarget.dataset.switch);
    });
  };
  const openAccountModal=(mode)=>{
    syncAccountForm(mode);
    accountModal.classList.remove("hidden");
    accountModal.setAttribute("aria-hidden","false");
    document.body.style.overflow="hidden";
  };
  document.getElementById("entry-request-access").addEventListener("click",()=>{
    closeEntryModal();
    openAccountModal("signup");
  });
  document.getElementById("entry-signin").addEventListener("click",()=>{
    closeEntryModal();
    openAccountModal("signin");
  });
  document.getElementById("entry-guest").addEventListener("click",closeEntryModal);
  const renderSignedOut=()=>{
    accountState.user=null;
    accountState.profile=null;
    window.sirioniUserRole=null;
    accountAccess.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></svg>Acceder';
    accountAccess.classList.remove("icon-button","profile-button");
    accountAccess.classList.add("quiet");
    accountAccess.setAttribute("aria-label","Ingresar o crear una cuenta");
    accountAccess.setAttribute("title","Ingresar o crear una cuenta");
    accountAccess.removeAttribute("aria-expanded");
    profileMenu.classList.add("hidden");
    profileMenu.setAttribute("aria-hidden","true");
    notifyAuthChange();
  };
  const renderSignedIn=(user,profile)=>{
    const adminUserId="f7435bbd-5b4d-4296-b6ce-c24db1edad2e";
    const isAdmin=user.id===adminUserId;
    const isFed=typeof profile?.role=== "boolean"&&profile.role===true;

    if(!isAdmin&&!isFed){
      throw new Error("Tu cuenta todavía no fue habilitada por el administrador.");
    }

    accountState.user=user;
    accountState.profile=profile;
    window.sirioniUserRole=isAdmin?"admin":"fed";

    const name=[profile?.nombre,profile?.apellido].filter(Boolean).join(" ")||user.email;
    accountAccess.classList.remove("quiet");
    accountAccess.classList.add("icon-button","profile-button");
    accountAccess.setAttribute("aria-label","Perfil de "+name);
    accountAccess.setAttribute("title","Perfil de "+name);
    accountAccess.setAttribute("aria-expanded","false");
    profileName.textContent=name;
    profileEmail.textContent=user.email||"";
    accountAccess.replaceChildren();
    accountAccess.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
    notifyAuthChange();
  };
  const loadProfile=async(user)=>{
    const {data,error}=await client.from("profiles")
      .select("id,nombre,apellido,mail,role")
      .eq("id",user.id)
      .maybeSingle();
    if(error)throw error;
    if(!data)throw new Error("No se encontró el perfil asociado a la cuenta.");
    return data;
  };
  const establishAccount=async(user)=>{
    try{
      const profile=await loadProfile(user);
      renderSignedIn(user,profile);
    }catch(error){
      const {error:signOutError}=await client.auth.signOut();
      if(signOutError)console.error("No se pudo cerrar la sesión sin perfil válido:",signOutError);
      throw error;
    }
  };
  accountForm.addEventListener("submit",async(event)=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    const mode=accountForm.dataset.mode;
    if(mode==="signup"){
      const formData=new FormData(accountForm);
      const recipient=String(config?.accountRequestsEmail||"").trim();
      if(!recipient||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)){
        toast("Configurá el Gmail administrativo en js/supabase-config.js. No se abrió el correo.");
        return;
      }
      const details=[
        ["Nombre",String(formData.get("firstName")||"").trim()],
        ["Apellido",String(formData.get("lastName")||"").trim()],
        ["Correo electrónico",String(formData.get("email")||"").trim()]
      ];
      const subject=encodeURIComponent("Solicitud de acceso institucional - Mapa Escolar");
      const body=encodeURIComponent(details.map(([label,value],index)=>`${index+1}. ${label}: ${value}`).join("\r\n\r\n")+"\r\n");
      window.location.href="mailto:"+encodeURIComponent(recipient)+"?subject="+subject+"&body="+body;
      toast("Se abrió un borrador de correo. Revisalo y envialo para completar la solicitud.");
      closeModal();
      accountForm.reset();
      return;
    }
    if(!navigator.onLine){
      toast("Iniciar sesión requiere conexión a internet.");
      return;
    }
    if(!client){
      toast(configured
        ?"No se pudo cargar Supabase. Revisá la conexión a internet y recargá la página."
        :"Configurá la URL y la clave pública de Supabase en js/supabase-config.js.");
      return;
    }
    const submit=accountForm.querySelector('[type="submit"]');
    const formData=new FormData(accountForm);
    const email=String(formData.get("email")||"").trim().toLowerCase();
    const password=String(formData.get("password")||"");
    submit.disabled=true;
    try{
      if(!email||!password)throw new Error("Completá el correo y la contraseña.");
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data.user)throw new Error("Supabase no devolvió el usuario autenticado.");
      await establishAccount(data.user);
      closeEntryModal();
      closeModal();
      accountForm.reset();
      toast("Sesión iniciada.");
    }catch(error){
      console.error("Error de cuenta Supabase:",error);
      toast(error.message||"No se pudo iniciar sesión.");
    }finally{
      submit.disabled=false;
    }
  },true);
  accountAccess.addEventListener("click",event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    if(!client||!client.auth||!profileEmail.textContent){
      openAccountModal("signin");
      return;
    }
    const open=profileMenu.classList.contains("hidden");
    profileMenu.classList.toggle("hidden",!open);
    profileMenu.setAttribute("aria-hidden",String(!open));
    accountAccess.setAttribute("aria-expanded",String(open));
  },true);
  document.getElementById("logout").addEventListener("click",async(event)=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    try{
      if(client){
        const {error}=await client.auth.signOut();
        if(error)throw error;
      }
      profileEmail.textContent="";
      renderSignedOut();
      toast("Sesión cerrada.");
    }catch(error){
      console.error("Error al cerrar la sesión:",error);
      toast(error.message||"No se pudo cerrar la sesión.");
    }
  },true);
  const restoreSession=async()=>{
    if(!client){
      openEntryModal();
      return;
    }
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(!data.session){
      localStorage.removeItem("sirioni-profile-login");
      openEntryModal();
      return;
    }
    await establishAccount(data.session.user);
    closeEntryModal();
  };
  restoreSession().catch(error=>{
    console.error("Error al recuperar la sesión de Supabase:",error);
    openEntryModal();
    toast(error.message||"No se pudo recuperar la sesión. Iniciá sesión nuevamente.");
  });
})();
