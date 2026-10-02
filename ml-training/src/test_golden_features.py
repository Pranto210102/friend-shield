import json
import os
import sys
from feature_extractor import extract_features

def test_golden_features():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    fixture_path = os.path.join(current_dir, "..", "golden-features.json")
    
    with open(fixture_path, "r", encoding="utf-8") as f:
        cases = json.load(f)
    
    print(f"=== Running Cross-Language Golden Feature Tests in Python ({len(cases)} cases) ===")
    
    for i, tc in enumerate(cases, 1):
        url = tc["url"]
        r_info = tc.get("redirectInfo", {})
        orig_url = r_info.get("originalUrl")
        fin_url = r_info.get("finalUrl")
        rc = r_info.get("redirectCount", 0)
        dc = r_info.get("domainChanged", 1 if r_info.get("domain_changed") else 0)
        hd = r_info.get("httpsDowngrade", 1 if r_info.get("https_downgrade") else 0)
        
        extracted = extract_features(
            url,
            redirect_count=rc,
            domain_changed=dc,
            https_downgrade=hd,
            original_url=orig_url,
            final_url=fin_url
        )
        expected = tc["expectedFeatures"]
        
        assert extracted == expected, (
            f"Mismatch on Case {i} ({tc['description']}):\n"
            f"Expected: {expected}\nGot:      {extracted}"
        )
        print(f"[PASS] Case {i}: {tc['description']} - 17/17 features match identically")

    print("\nALL PYTHON GOLDEN FEATURE TESTS PASSED IDENTICALLY!")

if __name__ == "__main__":
    test_golden_features()
