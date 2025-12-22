import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import LCARSButton from '../../components/LCARSButton';

const Security = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);

        if (password !== confirmPassword) {
            setError("AUTHORIZATION CODES DO NOT MATCH");
            return;
        }

        if (password.length < 6) {
            setError("AUTHORIZATION CODE MUST BE AT LEAST 6 CHARACTERS");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setMessage("AUTHORIZATION CODE UPDATED SUCCESSFULLY");
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError("UPDATE FAILED: " + err.message.toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '20px',
            border: '2px solid var(--lcars-orange)',
            borderRadius: '0 0 20px 20px',
            borderTop: 'none'
        }}>
            <h3 style={{color: 'var(--lcars-orange)', margin: 0}}>SECURITY PROTOCOLS</h3>
            
            <form onSubmit={handlePasswordChange} style={{display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <label style={{color: 'var(--lcars-tan)', fontSize: '0.9rem'}}>NEW AUTHORIZATION CODE</label>
                    <input 
                        type="password"
                        className="lcars-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="ENTER NEW PASSWORD"
                        style={{
                            backgroundColor: 'var(--lcars-bg)',
                            border: '1px solid var(--lcars-blue)',
                            color: 'var(--lcars-blue)',
                            padding: '10px',
                            fontFamily: 'var(--font-main)',
                            fontSize: '1rem',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <label style={{color: 'var(--lcars-tan)', fontSize: '0.9rem'}}>CONFIRM AUTHORIZATION CODE</label>
                    <input 
                        type="password"
                        className="lcars-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="CONFIRM NEW PASSWORD"
                        style={{
                            backgroundColor: 'var(--lcars-bg)',
                            border: '1px solid var(--lcars-blue)',
                            color: 'var(--lcars-blue)',
                            padding: '10px',
                            fontFamily: 'var(--font-main)',
                            fontSize: '1rem',
                            outline: 'none'
                        }}
                    />
                </div>

                {error && (
                    <div style={{
                        color: 'var(--lcars-red)', 
                        fontWeight: 'bold', 
                        border: '1px solid var(--lcars-red)',
                        padding: '10px'
                    }}>
                        ALERT: {error}
                    </div>
                )}

                {message && (
                    <div style={{
                        color: 'var(--lcars-ice-blue)', 
                        fontWeight: 'bold',
                        border: '1px solid var(--lcars-ice-blue)',
                        padding: '10px'
                    }}>
                        {message}
                    </div>
                )}

                <LCARSButton 
                    color="var(--lcars-orange)" 
                    type="submit"
                    disabled={loading}
                    rounded="both"
                >
                    {loading ? 'PROCESSING...' : 'UPDATE AUTHORIZATION'}
                </LCARSButton>
            </form>
        </div>
    );
};

export default Security;
