import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, query, where, 
  getDocs, updateDoc, doc, deleteDoc, onSnapshot, 
  Timestamp, or 
} from "firebase/firestore";

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAYll9CKwQwyKlRxd4aRWycEYG_I",
  authDomain: "manucontrol-3f74b.firebaseapp.com",
  projectId: "manucontrol-3f74b",
  storageBucket: "manucontrol-3f74b.firebasestorage.app",
  messagingSenderId: "200481035069",
  appId: "1:200481035069:web:8188a935f368fc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MOTIVOS = ["Falha Mecânica", "Falha Elétrica", "Falta de Material", "Setup / Troca", "Ajuste Fino", "Outro"];
const CARGOS = ["Tecelão", "Ajudante", "Contramestre", "Tc Líder", "Supervisor"];
const TURMAS = {
  A: { label: 'Turma A', horario: '05:15 – 13:45' },
  B: { label: 'Turma B', horario: '13:45 – 22:05' },
  C: { label: 'Turma C', horario: '22:05 – 05:15' }
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<"login" | "cadastro">("login");
  const [turma, setTurma] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem("@ControlTear:user");
    if (usuarioSalvo) setUser(JSON.parse(usuarioSalvo));
    setCarregando(false);
  }, []);

  const fazerLogin = (dados: any, manter: boolean) => {
    setUser(dados);
    if (manter) localStorage.setItem("@ControlTear:user", JSON.stringify(dados));
  };

  const fazerSair = () => {
    setUser(null);
    setTurma(null);
    localStorage.removeItem("@ControlTear:user");
  };

  if (carregando) return <div style={containerCenter}>Carregando...</div>;
  if (!user) return view === "login" ? <TelaLogin onLogin={fazerLogin} setView={setView} /> : <TelaCadastro onLogin={fazerLogin} setView={setView} />;
  if (!turma) return <TelaSelecaoTurma onSelect={setTurma} onSair={fazerSair} />;

  return <TelaPrincipal user={user} turma={turma} onTrocarTurma={() => setTurma(null)} onSair={fazerSair} />;
}

// --- TELAS ACESSO ---
function TelaSelecaoTurma({ onSelect, onSair }: any) {
  return (
    <div style={containerCenter} className="notranslate" translate="no">
      <h2 style={{color: "#3b82f6", marginBottom: "30px"}}>Selecione seu Turno</h2>
      {Object.entries(TURMAS).map(([key, info]: any) => (
        <div key={key} onClick={() => onSelect(key)} style={cardTurma}><h3>{info.label}</h3><small>{info.horario}</small></div>
      ))}
      <button onClick={onSair} style={btSair}>Sair da conta</button>
    </div>
  );
}

function TelaLogin({ onLogin, setView }: any) {
  const [nome, setNome] = useState(""); const [senha, setSenha] = useState(""); const [manter, setManter] = useState(true);
  const entrar = async () => {
    const q = query(collection(db, "usuarios"), where("nome", "==", nome), where("senha", "==", senha));
    const snap = await getDocs(q);
    if (!snap.empty) onLogin({ id: snap.docs[0].id, ...snap.docs[0].data() }, manter);
    else alert("Usuário/Senha incorretos!");
  };
  return (
    <div style={containerCenter} className="notranslate" translate="no">
      <h1 style={{color: "#3b82f6", fontWeight: "800"}}>ControlTear</h1>
      <div style={cardForm}>
        <input style={inStyle} placeholder="Usuário" onChange={e => setNome(e.target.value)} />
        <input style={inStyle} type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} />
        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
          <input type="checkbox" checked={manter} onChange={e=>setManter(e.target.checked)} style={{width:'18px', height:'18px'}} />
          <span style={{fontSize:'14px', color:'#cbd5e1'}}>Manter conectado</span>
        </div>
        <button onClick={entrar} style={btVerde}>ENTRAR</button>
        <p onClick={() => setView("cadastro")} style={{color: "#3b82f6", cursor: "pointer", marginTop: '15px'}}>Criar conta</p>
      </div>
    </div>
  );
}

function TelaCadastro({ onLogin, setView }: any) {
  const [nome, setNome] = useState(""); const [senha, setSenha] = useState(""); const [cargo, setCargo] = useState(CARGOS[0]);
  const cadastrar = async () => {
    const docRef = await addDoc(collection(db, "usuarios"), { nome, senha, funcao: cargo, criadoEm: Timestamp.now() });
    onLogin({ id: docRef.id, nome, funcao: cargo }, true);
  };
  return (
    <div style={containerCenter} className="notranslate" translate="no">
      <div style={cardForm}><h2>Cadastro</h2><input style={inStyle} placeholder="Nome" onChange={e => setNome(e.target.value)} /><select style={inStyle} value={cargo} onChange={e => setCargo(e.target.value)}>{CARGOS.map(c => <option key={c} value={c}>{c}</option>)}</select><input style={inStyle} type="password" placeholder="Senha" onChange={e => setSenha(e.target.value)} /><button onClick={cadastrar} style={btVerde}>CADASTRAR</button><p onClick={() => setView("login")} style={{color: "#94a3b8", cursor: "pointer", marginTop: '10px'}}>Voltar</p></div>
    </div>
  );
}

// --- TELA PRINCIPAL COM NOTIFICAÇÃO ---
function TelaPrincipal({ user, turma, onTrocarTurma, onSair }: any) {
  const [aba, setAba] = useState<"lançar" | "historico" | "dash">("lançar");
  const [maquina, setMaquina] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [obs, setObs] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [horaInicioEdit, setHoraInicioEdit] = useState("");
  const [horaFimEdit, setHoraFimEdit] = useState("");

  const [paradas, setParadas] = useState<any[]>([]);
  const [notificacao, setNotificacao] = useState<string | null>(null);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [filtroMaq, setFiltroMaq] = useState("");
  const [filtroMot, setFiltroMot] = useState("");

  const isFirstRun = useRef(true);
  const audioContext = useRef<AudioContext | null>(null);

  const podeGeral = ["Contramestre", "Tc Líder", "Supervisor"].includes(user.funcao);

  // Som de Notificação
  const tocarAlerta = () => {
    if (!audioContext.current) audioContext.current = new AudioContext();
    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    osc.connect(gain); gain.connect(audioContext.current.destination);
    osc.type = "sine"; osc.frequency.value = 880; gain.gain.value = 0.1;
    osc.start(); osc.stop(audioContext.current.currentTime + 0.2);
  };

  useEffect(() => {
    const q = query(collection(db, "paradas"), or(where("data", "==", dataFiltro), where("status", "==", "aberta")));

    const unsub = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Lógica de Notificação: Se houver um novo documento que não foi lançado por mim
      if (!isFirstRun.current && snapshot.docChanges().some(change => change.type === "added")) {
        const novo = snapshot.docChanges().find(c => c.type === "added")?.doc.data();
        if (novo && novo.operador !== user.nome) {
          setNotificacao(`🚨 NOVO LANÇAMENTO: Tear ${novo.numTear} - ${novo.motivo} (Turma ${novo.turma})`);
          tocarAlerta();
          setTimeout(() => setNotificacao(null), 6000);
        }
      }

      setParadas(dados.sort((a: any, b: any) => b.inicio.seconds - a.inicio.seconds));
      isFirstRun.current = false;
    });
    return () => unsub();
  }, [dataFiltro, user.nome]);

  const salvarParada = async () => {
    if (!maquina) return alert("Informe o Tear!");
    try {
      if (editId) {
        const updateObj: any = { numTear: maquina, motivo, observacao: obs, inicio: Timestamp.fromDate(new Date(horaInicioEdit)) };
        if (horaFimEdit) { updateObj.fim = Timestamp.fromDate(new Date(horaFimEdit)); updateObj.status = "finalizada"; }
        await updateDoc(doc(db, "paradas", editId), updateObj);
        setEditId(null);
      } else {
        await addDoc(collection(db, "paradas"), { numTear: maquina, motivo, observacao: obs, turma, data: dataFiltro, status: "aberta", operador: user.nome, inicio: Timestamp.now(), fim: null });
      }
      setMaquina(""); setObs(""); setAba("historico");
    } catch (e) { alert("Erro ao salvar."); }
  };

  const prepararEdicao = (p: any) => {
    setEditId(p.id); setMaquina(p.numTear); setMotivo(p.motivo); setObs(p.observacao || "");
    const dStr = (ts: any) => ts ? new Date(ts.toDate().getTime() - ts.toDate().getTimezoneOffset()*60000).toISOString().slice(0, 16) : "";
    setHoraInicioEdit(dStr(p.inicio)); setHoraFimEdit(dStr(p.fim));
    setAba("lançar");
  };

  const formatarMinutosParaHoras = (min: number) => {
    const h = Math.floor(min / 60); const m = Math.round(min % 60);
    return `${h}h ${m.toString().padStart(2, '0')}min`;
  };

  const formatarDataHora = (ts: any) => {
    if (!ts) return "-";
    const d = ts.toDate();
    return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) + " " + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  };

  const paradasFiltradas = paradas.filter(p => 
    (filtroMaq === "" || p.numTear === filtroMaq) && 
    (filtroMot === "" || p.motivo === filtroMot) &&
    (p.status === "aberta" || p.turma === turma)
  );

  const tempoTotalMin = paradasFiltradas.reduce((acc, p) => p.fim ? acc + (p.fim.seconds - p.inicio.seconds)/60 : acc, 0);

  return (
    <div style={mainBg} className="notranslate" translate="no">
      {/* BANNER DE NOTIFICAÇÃO */}
      {notificacao && (
        <div style={toastStyle} onClick={() => setNotificacao(null)}>
          {notificacao}
        </div>
      )}

      <header style={headerStyle}>
        <div><h4 style={{margin:0, color: "#3b82f6"}}>{user.nome}</h4><small>Turma {turma} | {user.funcao}</small></div>
        <button onClick={onTrocarTurma} style={btSair}>TURNO</button>
      </header>

      <nav style={navStyle}>
        <button onClick={() => {setAba("lançar"); setEditId(null);}} style={{...tabStyle, opacity: aba === "lançar" ? 1 : 0.4}}>NOVA</button>
        <button onClick={() => setAba("historico")} style={{...tabStyle, opacity: aba === "historico" ? 1 : 0.4}}>LISTA</button>
        <button onClick={() => setAba("dash")} style={{...tabStyle, opacity: aba === "dash" ? 1 : 0.4}}>PAINEL</button>
      </nav>

      {aba === "lançar" && (
        <div style={cardForm}>
          <h3>{editId ? "⚙️ Editar" : "🚀 Lançar"}</h3>
          <label style={labelStyle}>TEAR</label><input style={inStyle} type="number" value={maquina} onChange={e => setMaquina(e.target.value)} />
          <label style={labelStyle}>MOTIVO</label><select style={inStyle} value={motivo} onChange={e => setMotivo(e.target.value)}>{MOTIVOS.map(m => <option key={m}>{m}</option>)}</select>
          {editId && <>
            <label style={labelStyle}>INÍCIO</label><input style={inStyle} type="datetime-local" value={horaInicioEdit} onChange={e => setHoraInicioEdit(e.target.value)} />
            <label style={labelStyle}>FIM</label><input style={inStyle} type="datetime-local" value={horaFimEdit} onChange={e => setHoraFimEdit(e.target.value)} />
          </>}
          <label style={labelStyle}>OBSERVAÇÃO</label><textarea style={{...inStyle, height: '60px'}} value={obs} onChange={e => setObs(e.target.value)} />
          <button onClick={salvarParada} style={btVerde}>{editId ? "SALVAR" : "REGISTRAR"}</button>
        </div>
      )}

      {aba === "historico" && (
        <div>
          <input type="date" style={inStyle} value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
          {paradas.map(p => {
            const isOutraTurma = p.turma !== turma && p.status === "aberta";
            return (
              <div key={p.id} style={{...cardStyle, borderLeft: `5px solid ${p.status === 'aberta' ? (isOutraTurma ? '#f59e0b' : '#ef4444') : '#22c55e'}`}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <strong>TEAR {p.numTear}</strong>
                  {podeGeral && <div><span onClick={()=>prepararEdicao(p)}>✏️</span> <span onClick={async ()=>{if(confirm("Apagar?")) await deleteDoc(doc(db,"paradas",p.id))}}>🗑️</span></div>}
                </div>
                <div style={{fontSize:'14px', fontWeight:'bold'}}>{p.motivo} {isOutraTurma && <span style={{fontSize: '9px', background: '#f59e0b', color: '#000', padding: '2px 5px', borderRadius: '4px', marginLeft: '5px'}}>ABERTA {p.turma}</span>}</div>
                <div style={{fontSize:'11px', opacity: 0.8, marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px'}}>
                  <div>🛫 Início: <strong>{formatarDataHora(p.inicio)}</strong></div>
                  {p.fim && <div style={{color: '#22c55e'}}>🏁 Fim: <strong>{formatarDataHora(p.fim)}</strong></div>}
                </div>
                {p.status === "aberta" && podeGeral && <button onClick={()=>updateDoc(doc(db,"paradas",p.id),{status:"finalizada",fim:Timestamp.now()})} style={btFinalizar}>FINALIZAR</button>}
              </div>
            );
          })}
        </div>
      )}

      {aba === "dash" && (
        <div>
          <div style={cardForm}>
            <div style={{display: 'flex', gap: '5px', marginBottom: '15px'}}>
              <select style={{...inStyle, marginBottom:0}} onChange={e=>setFiltroMaq(e.target.value)}><option value="">Teares</option>{Array.from(new Set(paradas.map(p=>p.numTear))).map(m=><option key={m} value={m}>Tear {m}</option>)}</select>
              <select style={{...inStyle, marginBottom:0}} onChange={e=>setFiltroMot(e.target.value)}><option value="">Motivos</option>{MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}</select>
            </div>
            <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <div style={statCard}><small>TOTAL</small><h2>{paradasFiltradas.length}</h2></div>
              <div style={statCard}><small>HORAS TOTAL</small><h2 style={{fontSize:'18px'}}>{formatarMinutosParaHoras(tempoTotalMin)}</h2></div>
            </div>
            <button onClick={()=>{
              const win = window.open("","_blank");
              win?.document.write(`<html><body style="font-family:sans-serif"><h2>Relatorio Turma ${turma}</h2><table border="1" style="width:100%;border-collapse:collapse"><tr><th>Tear</th><th>Motivo</th><th>Início</th><th>Fim</th><th>Duração</th></tr>${paradasFiltradas.map(p=>`<tr><td>${p.numTear}</td><td>${p.motivo}</td><td>${formatarDataHora(p.inicio)}</td><td>${formatarDataHora(p.fim)}</td><td>${p.fim ? formatarMinutosParaHoras((p.fim.seconds - p.inicio.seconds)/60) : '-'}</td></tr>`).join('')}</table></body></html>`);
              win?.print();
            }} style={{...btVerde, marginTop: '15px', background: '#3b82f6'}}>GERAR PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ESTILOS ---
const mainBg: any = { padding: "15px", background: "#0f172a", minHeight: "100vh", color: "#f8fafc", fontFamily: "sans-serif" };
const containerCenter: any = { padding: "40px 20px", textAlign: "center", background: "#0f172a", minHeight: "100vh" };
const cardForm: any = { background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(10px)", borderRadius: "20px", padding: "20px", border: '1px solid rgba(255,255,255,0.05)' };
const cardTurma: any = { background: "rgba(59, 130, 246, 0.2)", border: "1px solid #3b82f6", padding: "20px", borderRadius: "15px", marginBottom: "15px", cursor: 'pointer' };
const cardStyle: any = { background: "rgba(30, 41, 59, 0.5)", padding: "15px", borderRadius: "12px", marginBottom: "10px" };
const statCard: any = { flex: 1, background: "rgba(30, 41, 59, 0.8)", padding: "15px", borderRadius: "15px", textAlign: 'center' };
const inStyle: any = { width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "8px", background: "#1e293b", color: "#fff", border: "1px solid #334155", boxSizing: "border-box" };
const btVerde: any = { width: "100%", padding: "15px", background: "#22c55e", border: "none", color: "#fff", borderRadius: "10px", fontWeight: "bold" };
const btFinalizar: any = { width: "100%", padding: "10px", background: "#3b82f6", border: "none", color: "#fff", borderRadius: "8px", marginTop: "10px", fontWeight: 'bold' };
const btSair: any = { background: "none", border: "1px solid #ef4444", color: "#ef4444", padding: "5px 12px", borderRadius: "8px", fontSize: "12px" };
const headerStyle: any = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" };
const navStyle: any = { display: "flex", justifyContent: "space-around", marginBottom: "20px" };
const tabStyle: any = { background: "none", border: "none", color: "#fff", fontWeight: "bold" };
const labelStyle: any = { fontSize: "10px", color: "#3b82f6", display: "block", marginBottom: "5px", fontWeight: 'bold' };
const toastStyle: any = { position: 'fixed', top: '20px', left: '20px', right: '20px', background: '#3b82f6', color: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 9999, fontWeight: 'bold', textAlign: 'center', border: '2px solid #fff', animation: 'slideIn 0.3s ease-out' };
