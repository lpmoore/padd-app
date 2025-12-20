import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import LCARSButton from '../components/LCARSButton';

const Auth = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState('LOGIN'); // or SIGNUP

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (mode === 'SIGNUP') {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                alert('Success! Check your email for the confirmation link.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (error) {
            alert(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'black',
            color: 'var(--lcars-tan)'
        }}>
            <div style={{
                width: '400px',
                border: '4px solid var(--lcars-orange)',
                borderRadius: '20px',
                borderBottomLeftRadius: '0',
                padding: '30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                <h2 className="lcars-header" style={{textAlign: 'center', margin: 0}}>
                    {mode === 'LOGIN' ? 'PERSONNEL IDENTIFICATION' : 'NEW COMMISSION'}
                </h2>
                
                <form onSubmit={handleAuth} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    <input 
                        className="lcars-input"
                        type="email" 
                        placeholder="IDENTIFICATION (EMAIL)" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                    />
                    <input 
                        className="lcars-input"
                        type="password" 
                        placeholder="AUTHORIZATION CODE" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                    />
                    
                    <LCARSButton 
                        color="var(--lcars-orange)" 
                        onClick={(e) => handleAuth(e)}
                        disabled={loading}
                    >
                        {loading ? 'PROCESSING...' : (mode === 'LOGIN' ? 'AUTHENTICATE' : 'INITIATE')}
                    </LCARSButton>
                </form>

                <div style={{display: 'flex', justifyContent: 'center', gap: '10px'}}>
                    <button 
                        onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--lcars-blue)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontFamily: 'var(--font-main)'
                        }}
                    >
                        {mode === 'LOGIN' ? 'REQUEST NEW COMMISSION' : 'RETURN TO LOGIN'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
