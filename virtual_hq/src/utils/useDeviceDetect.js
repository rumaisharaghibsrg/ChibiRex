import { useState, useEffect } from 'react';

/**
 * Hook untuk mendeteksi kapabilitas sentuhan, orientasi layar,
 * dan breakpoint ukuran viewport secara reaktif.
 */
export function useDeviceDetect() {
    const checkDevice = () => {
        const hasTouch = typeof window !== 'undefined' && (
            'ontouchstart' in window ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
        );

        const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const height = typeof window !== 'undefined' ? window.innerHeight : 768;
        const isMobileScreen = width <= 768;
        const isPortrait = height > width;

        return {
            isTouch: Boolean(hasTouch),
            isMobileScreen,
            isPortrait,
            shouldShowMobileControls: Boolean(hasTouch) || isMobileScreen,
            width,
            height,
        };
    };

    const [deviceInfo, setDeviceInfo] = useState(checkDevice);

    useEffect(() => {
        let timeoutId = null;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setDeviceInfo(checkDevice());
            }, 100);
        };

        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('orientationchange', handleResize, { passive: true });

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    return deviceInfo;
}

export default useDeviceDetect;
