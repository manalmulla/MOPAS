import os
import re
import pandas as pd
import numpy as np
from urllib.parse import urlparse
import math
import glob
import json
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
import joblib

def calculate_entropy(text):
    if not text: return 0
    probabilities = [float(text.count(c)) / len(text) for c in set(text)]
    return - sum([p * math.log2(p) for p in probabilities])

def extract_features(url_str):
    try:
        if not isinstance(url_str, str): url_str = str(url_str)
        if not url_str.startswith('http'):
            url_str = 'http://' + url_str
        parsed = urlparse(url_str)
        hostname = parsed.hostname or ''
        path = parsed.path or ''
        query = parsed.query or ''
        
        features = {
            'url_length': len(url_str),
            'hostname_length': len(hostname),
            'path_length': len(path),
            'num_dots': url_str.count('.'),
            'num_hyphens': url_str.count('-'),
            'num_underscores': url_str.count('_'),
            'num_slashes': url_str.count('/'),
            'num_at': url_str.count('@'),
            'num_question': url_str.count('?'),
            'num_equals': url_str.count('='),
            'num_ampersand': url_str.count('&'),
            'num_percent': url_str.count('%'),
            'num_digits_url': sum(c.isdigit() for c in url_str),
            'digit_ratio': sum(c.isdigit() for c in url_str) / len(url_str) if len(url_str) > 0 else 0,
            'special_char_ratio': len(re.findall(r'[^a-zA-Z0-9]', url_str)) / len(url_str) if len(url_str) > 0 else 0,
            'url_entropy': calculate_entropy(url_str),
            'hostname_entropy': calculate_entropy(hostname),
            'num_subdomains': max(0, hostname.count('.') - 1),
            'has_ip': 1 if re.match(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$', hostname) else 0,
            'has_https': 1 if url_str.startswith('https') else 0,
            'has_shortener': 1 if any(s in hostname for s in ['bit.ly', 'goo.gl', 't.co', 'tinyurl.com']) else 0,
            'has_suspicious_words': 1 if any(w in url_str.lower() for w in ['login', 'verify', 'secure', 'update', 'banking', 'account', 'signin', 'confirm', 'password']) else 0,
            'path_depth': len([p for p in path.split('/') if p]),
            'query_length': len(query),
        }
        return list(features.values())
    except:
        return [0] * 24

def generate_mock_data(n=2000):
    data = []
    legit_domains = ['google.com', 'github.com', 'microsoft.com', 'apple.com', 'amazon.com', 'stackoverflow.com', 'wikipedia.org']
    for _ in range(n // 2):
        domain = np.random.choice(legit_domains)
        url = f"https://{domain}/{np.random.randint(100,999)}"
        data.append({'url': url, 'label': 0})
    for _ in range(n // 2):
        domain = f"secure-login-{np.random.randint(100,999)}.xyz"
        url = f"http://{domain}/auth"
        data.append({'url': url, 'label': 1})
    df = pd.DataFrame(data)
    features = df['url'].apply(extract_features).tolist()
    X = pd.DataFrame(features)
    y = df['label']
    return X, y

def train():
    print("MOPAS Random Forest Training Engine Started")
    files = glob.glob('data/*.csv')
    dfs = []
    
    if not files:
        print("No CSV datasets found. Using synthetic data.")
        X, y = generate_mock_data(5000)
    else:
        for f in files:
            print(f"Reading {f}...")
            df = pd.read_csv(f)
            if 'Domain' in df.columns: df.rename(columns={'Domain': 'url'}, inplace=True)
            if 'Label' in df.columns: df.rename(columns={'Label': 'label'}, inplace=True)
            if 'url' in df.columns and 'label' in df.columns:
                df['label'] = df['label'].apply(lambda x: 1 if x > 0 else 0)
                dfs.append(df[['url', 'label']].dropna())
        
        if not dfs:
            X, y = generate_mock_data(5000)
        else:
            final_df = pd.concat(dfs, ignore_index=True)
            print(f"Extracting features from {len(final_df)} URLs...")
            features = [extract_features(u) for u in final_df['url']]
            X = pd.DataFrame(features)
            y = final_df['label']
            
            # Balance
            phish_count = (y == 1).sum()
            safe_count = (y == 0).sum()
            if safe_count < phish_count:
                print(f"Balancing dataset...")
                X_mock, y_mock = generate_mock_data((phish_count - safe_count) * 2)
                X_mock = X_mock[y_mock == 0]
                y_mock = y_mock[y_mock == 0]
                X = pd.concat([X, X_mock], ignore_index=True)
                y = pd.concat([y, y_mock], ignore_index=True)

    print(f"Final training set size: {len(X)} samples")
    
    # Train Accurate Random Forest
    print("Training Accurate Random Forest...")
    model = RandomForestClassifier(n_estimators=100, max_depth=None, min_samples_split=2, random_state=42, n_jobs=-1)
    model.fit(X, y)
    
    y_pred = model.predict(X)
    from sklearn.metrics import accuracy_score, precision_score, recall_score
    acc = accuracy_score(y, y_pred)
    prec = precision_score(y, y_pred)
    rec = recall_score(y, y_pred)
    
    print(f"Accuracy: {acc:.4f}, Precision: {prec:.4f}, Recall: {rec:.4f}")
    
    # Save Model as .pkl
    os.makedirs('backend/models', exist_ok=True)
    joblib.dump(model, 'backend/models/url_model.pkl')
    print("Saved backend/models/url_model.pkl")
    
    # Save Metadata for frontend metrics
    metadata = {
        'accuracy': float(acc),
        'precision': float(prec),
        'recall': float(rec),
        'timestamp': datetime.now().isoformat(),
        'model_type': 'RandomForest'
    }
    os.makedirs('public/models', exist_ok=True)
    with open('public/models/url_model_metadata.json', 'w') as f:
        json.dump(metadata, f)

if __name__ == "__main__":
    train()
