import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

const SearchableSelect = forwardRef(({ 
    options = [], 
    value, 
    onChange, 
    placeholder = 'Select option...', 
    required = false, 
    disabled = false,
    className = '',
    onEnter = null,
    noOptionsMessage = 'No matches found'
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => {
            if (disabled) return;
            setIsOpen(true);
            setActiveIndex(-1);
            setTimeout(() => {
                if (searchInputRef.current) searchInputRef.current.focus();
            }, 50);
        },
        close: () => setIsOpen(false)
    }));

    // Sync search text with selected label when closed
    const selectedOption = options.find(opt => String(opt.value) === String(value));
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    const filteredOptions = options.filter(opt => 
        String(opt.label).toLowerCase().includes(search.toLowerCase()) ||
        String(opt.value).toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (opt) => {
        onChange(opt.value);
        setIsOpen(false);
        setSearch('');
        if (onEnter) setTimeout(onEnter, 50);
    };

    const toggleOpen = () => {
        if (disabled) return;
        setIsOpen(!isOpen);
        if (!isOpen) setSearch('');
        setActiveIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen) {
                if (activeIndex >= 0 && filteredOptions[activeIndex]) {
                    handleSelect(filteredOptions[activeIndex]);
                } else if (selectedOption) {
                    setIsOpen(false);
                    if (onEnter) onEnter();
                }
            } else if (value) {
                if (onEnter) onEnter();
            } else {
                toggleOpen();
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div className={`searchable-select-container ${className} ${isOpen ? 'is-open' : ''} ${disabled ? 'disabled' : ''}`} ref={containerRef}>
            <div 
                className={`searchable-select-header ${isOpen ? 'active' : ''} ${required && !value ? 'invalid' : ''}`}
                onClick={toggleOpen}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                   if (e.key === 'Enter') handleKeyDown(e);
                }}
            >
                <div className="selected-value">
                    {selectedOption ? (
                        <span className="label-text">{selectedOption.label}</span>
                    ) : (
                        <span className="placeholder-text">{placeholder}</span>
                    )}
                </div>
                <div className="select-icons">
                    {value && !disabled && (
                        <X 
                            size={14} 
                            className="clear-icon" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                        />
                    )}
                    <ChevronDown size={16} className={`chevron-icon ${isOpen ? 'rotate' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="searchable-select-dropdown animate-scale-in">
                    <div className="search-box">
                        <Search size={14} className="search-icon" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="options-list">
                        {filteredOptions.length === 0 ? (
                            <div className="no-options" style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                                {noOptionsMessage}
                            </div>
                        ) : (
                            filteredOptions.map((opt, i) => (
                                <div 
                                    key={i} 
                                    className={`option-item ${String(opt.value) === String(value) ? 'selected' : ''} ${activeIndex === i ? 'keyboard-active' : ''}`}
                                    onClick={() => handleSelect(opt)}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    style={{ paddingLeft: opt.level ? `${opt.level * 16}px` : '12px' }}
                                >
                                    <span className="option-label">{opt.label}</span>
                                    {String(opt.value) === String(value) && <Check size={14} className="check-icon" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

export default SearchableSelect;
