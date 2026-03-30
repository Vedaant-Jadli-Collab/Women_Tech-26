def get_sample_frac(accuracy_target:float)->float:

    if not 0<=accuracy_target<=1.0:
        raise ValueError(f"accuracy_target must be between 0 and 1, got {accuracy_target}")
    
    ACCURACY_TO_FRAC = {
        0.80: 0.01,
        0.85: 0.02,
        0.90: 0.05,
        0.95: 0.10,
        0.97: 0.20,
        0.99: 0.50,
        1.00: 1.00
    }

    for threshold in sorted(ACCURACY_TO_FRAC.keys()):
        if accuracy_target <= threshold:
            return ACCURACY_TO_FRAC[threshold]
        
    return 1.0