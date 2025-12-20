
export const formatDateForInput = (isoString) => {
    if (!isoString) return '';
    try {
        // Create date object
        const date = new Date(isoString);
        // Manual formatting to YYYY-MM-DDTHH:mm to avoid timezone shifting issues if using toISOString
        // Actually, datetime-local expects local time, so we should map to local components
        // PAD with leading zeros
        const pad = (n) => n < 10 ? '0' + n : n;
        
        const YYYY = date.getFullYear();
        const MM = pad(date.getMonth() + 1);
        const DD = pad(date.getDate());
        const HH = pad(date.getHours());
        const mm = pad(date.getMinutes());
        
        return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
    } catch (e) {
        console.error('Date formatting error:', e);
        return '';
    }
};

export const formatDateForDisplay = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString();
};
