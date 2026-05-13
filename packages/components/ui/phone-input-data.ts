export interface PhoneCountry {
    code: string;
    name: string;
    flag: string;
    dialCode: string;
    placeholder?: string;
}

export const DEFAULT_COUNTRIES: PhoneCountry[] = [
    { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1', placeholder: '(555) 000-0000' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1', placeholder: '(555) 000-0000' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44', placeholder: '7911 123456' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61', placeholder: '0412 345 678' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49', placeholder: '01512 3456789' },
    { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33', placeholder: '06 12 34 56 78' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34', placeholder: '612 34 56 78' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39', placeholder: '312 345 6789' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹', dialCode: '+351', placeholder: '912 345 678' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dialCode: '+31', placeholder: '06 12345678' },
    { code: 'BE', name: 'Belgium', flag: '🇧🇪', dialCode: '+32', placeholder: '0470 12 34 56' },
    { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dialCode: '+41', placeholder: '078 123 45 67' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪', dialCode: '+46', placeholder: '070-123 45 67' },
    { code: 'NO', name: 'Norway', flag: '🇳🇴', dialCode: '+47', placeholder: '406 12 345' },
    { code: 'DK', name: 'Denmark', flag: '🇩🇰', dialCode: '+45', placeholder: '20 12 34 56' },
    { code: 'FI', name: 'Finland', flag: '🇫🇮', dialCode: '+358', placeholder: '041 2345678' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱', dialCode: '+48', placeholder: '512 345 678' },
    { code: 'CZ', name: 'Czechia', flag: '🇨🇿', dialCode: '+420', placeholder: '601 123 456' },
    { code: 'AT', name: 'Austria', flag: '🇦🇹', dialCode: '+43', placeholder: '0664 1234567' },
    { code: 'IE', name: 'Ireland', flag: '🇮🇪', dialCode: '+353', placeholder: '085 012 3456' },
    { code: 'GR', name: 'Greece', flag: '🇬🇷', dialCode: '+30', placeholder: '691 2345678' },
    { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91', placeholder: '81234 56789' },
    { code: 'CN', name: 'China', flag: '🇨🇳', dialCode: '+86', placeholder: '131 2345 6789' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81', placeholder: '090-1234-5678' },
    { code: 'KR', name: 'South Korea', flag: '🇰🇷', dialCode: '+82', placeholder: '010-1234-5678' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷', dialCode: '+55', placeholder: '(11) 91234-5678' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽', dialCode: '+52', placeholder: '222 123 4567' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷', dialCode: '+54', placeholder: '11 1234-5678' },
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dialCode: '+27', placeholder: '071 123 4567' },
    { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dialCode: '+234', placeholder: '0802 123 4567' },
    { code: 'EG', name: 'Egypt', flag: '🇪🇬', dialCode: '+20', placeholder: '0100 123 4567' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966', placeholder: '051 234 5678' },
    { code: 'AE', name: 'UAE', flag: '🇦🇪', dialCode: '+971', placeholder: '050 123 4567' },
    { code: 'IL', name: 'Israel', flag: '🇮🇱', dialCode: '+972', placeholder: '050-123-4567' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬', dialCode: '+65', placeholder: '8123 4567' },
];
