import React from 'react';
import { ArrowRight, Copy, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { supabase, supabaseConfigStatus } from '../../supabaseClient';
import { passwordStrength } from '../../utils/validators';
import loginLogo from '../../../imagem/logo.png';
import beeIcon from '../../../imagem/icone.png';

function authCallbackParams() {
  const hashText = window.location.hash.replace(/^#/, '').replace(/^create-password[?&]?/, '');
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(hashText);
  return {
    accessToken: hashParams.get('access_token') || searchParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token') || searchParams.get('refresh_token'),
    code: searchParams.get('code') || hashParams.get('code'),
    error: searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error'),
  };
}

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function PasswordInput({ label, value, onChange, placeholder, canCopy = false, autoComplete = 'new-password' }) {
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function copyPassword() {
    if (!value) return;
    try {
      setCopied(await copyText(String(value)));
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <label>
      {label}
      <div className="password-input-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        {canCopy && (
          <button type="button" onClick={copyPassword} aria-label="Copiar senha">
            <Copy size={17} />
          </button>
        )}
      </div>
      {canCopy && copied && <span className="field-help">Senha copiada.</span>}
    </label>
  );
}

export function LoginView({ onLoginSuccess }) {
  const savedLogin = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('beelbem.rememberLogin') || '{}');
    } catch {
      return {};
    }
  }, []);
  const [form, setForm] = React.useState({
    email: savedLogin.email || '',
    password: savedLogin.password || '',
    remember: Boolean(savedLogin.remember),
  });
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    if (!form.email.trim() || !form.password) {
      setError('Informe e-mail e senha.');
      return;
    }

    if (!supabase) {
      const missing = [
        !supabaseConfigStatus.hasUrl ? 'VITE_SUPABASE_URL' : '',
        !supabaseConfigStatus.hasAnonKey ? 'VITE_SUPABASE_ANON_KEY' : '',
      ].filter(Boolean).join(' e ');
      setError(`Supabase nao configurado. Falta ${missing} no Vercel.`);
      return;
    }

    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);

    if (signInError) {
      const message = (signInError.message || '').toLowerCase();
      if (message.includes('invalid login credentials')) {
        setError('E-mail ou senha incorretos. Verifique os dados e tente novamente.');
      } else if (message.includes('email not confirmed')) {
        setError('Este e-mail ainda nao foi confirmado. Verifique sua caixa de entrada.');
      } else {
        setError('Nao foi possivel fazer login agora. Tente novamente em alguns instantes.');
      }
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, city_id, store_id, courier_id, active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      setError('Login validado, mas nao foi possivel consultar seu perfil de acesso.');
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();
      setError('Usuario autenticado, mas sem perfil cadastrado no sistema. Peca ao administrador para liberar seu acesso.');
      return;
    }

    if (profile?.active === false) {
      await supabase.auth.signOut();
      setError('Usuario inativo. Entre em contato com o administrador.');
      return;
    }

    if (form.remember) {
      localStorage.setItem('beelbem.rememberLogin', JSON.stringify({
        remember: true,
        email: form.email.trim(),
        password: form.password,
      }));
    } else {
      localStorage.removeItem('beelbem.rememberLogin');
    }

    onLoginSuccess?.(data.user, profile);
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Beelbem Motoboy">
        <img src={loginLogo} alt="Beelbem Motoboy" />
      </section>
      <section className="login-panel">
        <div className="app-login-brand">
          <img src={beeIcon} alt="" />
          <div>
            <strong>BEELBEM</strong>
            <span>MOTOBOY</span>
          </div>
        </div>
        <h1>Bem-vindo de volta!</h1>
        <p>Faca login para continuar e comecar a fazer entregas.</p>
        <form onSubmit={handleLogin}>
          <label>
            E-mail ou telefone
            <div className="login-input-wrap">
              <Mail size={25} />
              <input
                type="text"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Digite seu e-mail ou telefone"
                autoComplete="username"
              />
            </div>
          </label>
          <label>
            Senha
            <div className="login-input-wrap">
              <LockKeyhole size={25} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? <EyeOff size={23} /> : <Eye size={23} />}
              </button>
            </div>
          </label>
          <a className="forgot-inline" href="#forgot-password">Esqueci minha senha</a>
          <label className="remember-login">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(event) => setForm((current) => ({ ...current, remember: event.target.checked }))}
            />
            <span>Manter-me conectado.</span>
          </label>
          {error && <p className="field-error">{error}</p>}
          <button className="primary-action" type="submit" disabled={loading}>
            <span>{loading ? 'Entrando...' : 'Entrar'}</span>
            {!loading && <ArrowRight size={32} />}
          </button>
          <div className="auth-links">
            <span>Ainda nao tem uma conta?</span>
            <a href="#join">Cadastre-se</a>
          </div>
        </form>
      </section>
    </main>
  );
}

export function ForgotPasswordView() {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }
    if (!supabase) {
      setError('Supabase nao configurado. Redefinicao bloqueada.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/#create-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message || 'Nao foi possivel enviar o link.');
      return;
    }
    setStatus('Enviamos um link de redefinicao para o e-mail informado.');
  }

  return (
    <main className="password-page">
      <section className="password-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Redefinir senha</h1>
        <p>Informe o e-mail cadastrado. O Supabase enviara um link seguro para criar uma nova senha.</p>
        <form onSubmit={handleSubmit}>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@empresa.com"
            />
          </label>
          {error && <p className="field-error">{error}</p>}
          {status && <p className="success-message">{status}</p>}
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
          <div className="auth-links single">
            <a href="#login">Voltar para login</a>
          </div>
        </form>
      </section>
    </main>
  );
}

export function CreateAccountView() {
  const [form, setForm] = React.useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const strength = passwordStrength(form.password);
  const passwordsMatch = form.password && form.password === form.confirmPassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Informe nome e e-mail.');
      return;
    }
    if (!strength.valid) {
      setError('A senha ainda nao atende aos requisitos de seguranca.');
      return;
    }
    if (!passwordsMatch) {
      setError('A confirmacao da senha nao confere.');
      return;
    }
    if (!supabase) {
      setError('Supabase nao configurado. Criacao de conta bloqueada.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { name: form.name.trim() },
        emailRedirectTo: `${window.location.origin}/#login`,
      },
    });
    setLoading(false);

    if (signUpError) {
      const message = signUpError.message || '';
      if (message.toLowerCase().includes('confirmation email')) {
        setError('O Supabase nao conseguiu enviar o e-mail de confirmacao. Use o cadastro pelo administrador em Acessos ou configure o SMTP do Supabase.');
      } else {
        setError(message || 'Nao foi possivel criar a conta.');
      }
      return;
    }

    setStatus('Conta criada no Auth. Agora o administrador precisa liberar seu perfil de acesso.');
    setForm({ name: '', email: '', password: '', confirmPassword: '' });
  }

  return (
    <main className="password-page">
      <section className="password-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Criar conta</h1>
        <p>Crie o acesso inicial. A entrada no sistema so sera liberada depois que um administrador vincular seu perfil.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Nome
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Seu nome"
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="voce@empresa.com"
            />
          </label>
          <PasswordInput
            label="Senha"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Digite uma senha forte"
            canCopy
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirmar senha"
            value={form.confirmPassword}
            onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            placeholder="Repita a senha"
            autoComplete="new-password"
          />
          <div className="password-rules">
            <span className={strength.checks.length ? 'ok' : ''}>6 caracteres ou mais</span>
            <span className={strength.checks.upper ? 'ok' : ''}>Letra maiuscula</span>
            <span className={strength.checks.lower ? 'ok' : ''}>Letra minuscula</span>
            <span className={strength.checks.symbol ? 'ok' : ''}>Simbolo</span>
            <span className={passwordsMatch ? 'ok' : ''}>Confirmacao igual</span>
          </div>
          {error && <p className="field-error">{error}</p>}
          {status && <p className="success-message">{status}</p>}
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
          <div className="auth-links single">
            <a href="#login">Voltar para login</a>
          </div>
        </form>
      </section>
    </main>
  );
}

export function CreatePasswordView() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [error, setError] = React.useState('');
  const [setupLoading, setSetupLoading] = React.useState(Boolean(supabase));
  const [setupUserEmail, setSetupUserEmail] = React.useState('');
  const [savingPassword, setSavingPassword] = React.useState(false);
  const strength = passwordStrength(password);
  const passwordsMatch = password && password === confirmPassword;

  React.useEffect(() => {
    let mounted = true;

    async function preparePasswordSession() {
      if (!supabase) {
        setSetupLoading(false);
        return;
      }

      setSetupLoading(true);
      const callback = authCallbackParams();
      if (callback.error) {
        if (mounted) {
          setError(`Link invalido: ${callback.error}`);
          setSetupLoading(false);
        }
        return;
      }

      if (callback.accessToken && callback.refreshToken) {
        await supabase.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
      } else if (callback.code) {
        await supabase.auth.exchangeCodeForSession(callback.code);
      }

      const { data, error: userError } = await supabase.auth.getUser();
      if (!mounted) return;

      if (userError || !data.user) {
        setError('Link expirado ou invalido. Solicite um novo convite para criar a senha.');
        setSetupUserEmail('');
      } else {
        setSetupUserEmail(data.user.email || '');
      }
      setSetupLoading(false);
    }

    preparePasswordSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');

    if (!strength.valid) {
      setError('A senha ainda nao atende aos requisitos de seguranca.');
      return;
    }
    if (!passwordsMatch) {
      setError('A confirmacao da senha nao confere.');
      return;
    }
    if (!supabase) {
      setError('Supabase nao configurado. Nao foi possivel salvar a senha no Auth.');
      return;
    }
    if (setupLoading) {
      setError('Aguarde a validacao do link antes de salvar a senha.');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Link expirado ou invalido. Solicite um novo convite para criar a senha.');
      return;
    }

    const targetEmail = userData.user.email || setupUserEmail;
    if (!targetEmail) {
      setError('Nao foi possivel identificar o e-mail deste link. Solicite um novo convite.');
      return;
    }

    setSavingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSavingPassword(false);
      setError(updateError.message || 'Link expirado ou invalido. Solicite um novo convite.');
      return;
    }

    await supabase.functions.invoke('complete-password-setup');
    await supabase.auth.signOut();

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (verifyError) {
      setSavingPassword(false);
      setError('A senha foi enviada ao Supabase, mas o login de validacao falhou. Gere um novo link ou redefina a senha pelo administrador.');
      return;
    }

    await supabase.auth.signOut();
    setSavingPassword(false);
    setStatus('Senha criada e login validado com sucesso. Agora voce ja pode acessar o sistema.');
  }

  return (
    <main className="password-page">
      <section className="password-panel">
        <div className="logo dark auth-logo"><img src={beeIcon} alt="" /><span>BEELBEM</span></div>
        <h1>Criar senha</h1>
        <p>Este link de confirmacao expira em 1 hora. Use uma senha forte para proteger sua conta.</p>
        {setupLoading && <p className="form-note">Validando link de criacao de senha...</p>}
        {!setupLoading && setupUserEmail && (
          <p className="setup-user-note">A senha sera criada para <strong>{setupUserEmail}</strong>.</p>
        )}
        <form onSubmit={handleSubmit}>
          <PasswordInput
            label="Nova senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite uma senha forte"
            canCopy
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirmar senha"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a senha"
            autoComplete="new-password"
          />
          <div className="password-rules">
            <span className={strength.checks.length ? 'ok' : ''}>6 caracteres ou mais</span>
            <span className={strength.checks.upper ? 'ok' : ''}>Letra maiuscula</span>
            <span className={strength.checks.lower ? 'ok' : ''}>Letra minuscula</span>
            <span className={strength.checks.symbol ? 'ok' : ''}>Simbolo</span>
            <span className={passwordsMatch ? 'ok' : ''}>Confirmacao igual</span>
          </div>
          {error && <p className="field-error">{error}</p>}
          {status && <p className="success-message">{status}</p>}
          <button className="primary-action" type="submit" disabled={setupLoading || savingPassword || Boolean(status)}>
            {setupLoading ? 'Validando link...' : savingPassword ? 'Validando senha...' : 'Salvar senha'}
          </button>
          {status && (
            <div className="auth-links single">
              <a href="#login">Ir para login</a>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
