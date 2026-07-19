import os
import time
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit, GridSearchCV
from sklearn.metrics import classification_report, accuracy_score, f1_score, precision_score, recall_score
import joblib
import mlflow
import mlflow.sklearn
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def compute_rsi(series, window=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def compute_macd(series, fast=12, slow=26, signal=9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def compute_bollinger(series, window=20, num_std=2):
    sma = series.rolling(window=window).mean()
    std = series.rolling(window=window).std()
    upper = sma + num_std * std
    lower = sma - num_std * std
    pct_b = (series - lower) / (upper - lower)
    bandwidth = (upper - lower) / sma
    return sma, upper, lower, pct_b, bandwidth

def compute_atr(high, low, close, window=14):
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=window).mean()

def compute_adx(high, low, close, window=14):
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
    atr = compute_atr(high, low, close, window)
    plus_di = 100 * (plus_dm.rolling(window=window).mean() / atr)
    minus_di = 100 * (minus_dm.rolling(window=window).mean() / atr)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    adx = dx.rolling(window=window).mean()
    return adx, plus_di, minus_di

def engineer_features(df):
    df = df.copy()

    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    df['Price_vs_SMA50_%'] = ((df['Close'] - df['SMA_50']) / df['SMA_50']) * 100

    df['SMA_200'] = df['Close'].rolling(window=200).mean()
    df['Price_vs_SMA200_%'] = ((df['Close'] - df['SMA_200']) / df['SMA_200']) * 100

    df['RSI_14'] = compute_rsi(df['Close'], 14)
    df['RSI_7'] = compute_rsi(df['Close'], 7)

    df['Vol_SMA_20'] = df['Volume'].rolling(window=20).mean()
    df['Volume_Surge'] = df['Volume'] / df['Vol_SMA_20']

    macd_line, signal_line, histogram = compute_macd(df['Close'])
    df['MACD'] = macd_line
    df['MACD_Signal'] = signal_line
    df['MACD_Histogram'] = histogram
    df['MACD_Cross'] = (macd_line > signal_line).astype(int)

    sma_bb, upper_bb, lower_bb, pct_b, bandwidth = compute_bollinger(df['Close'])
    df['BB_PctB'] = pct_b
    df['BB_Bandwidth'] = bandwidth

    if 'High' in df.columns and 'Low' in df.columns:
        df['ATR_14'] = compute_atr(df['High'], df['Low'], df['Close'], 14)
        df['ATR_Pct'] = df['ATR_14'] / df['Close'] * 100

        adx, plus_di, minus_di = compute_adx(df['High'], df['Low'], df['Close'], 14)
        df['ADX'] = adx
        df['Plus_DI'] = plus_di
        df['Minus_DI'] = minus_di

    df['Volatility_20'] = df['Close'].pct_change().rolling(window=20).std() * np.sqrt(252)

    df['Momentum_10'] = df['Close'] / df['Close'].shift(10) - 1
    df['Momentum_20'] = df['Close'] / df['Close'].shift(20) - 1

    return df

def train_production_model():
    mlflow.set_experiment("Quant AI - SPY RF Model")

    with mlflow.start_run(run_name="18-FEATURE RF + GridSearch"):
        print("Fetching historical data for SPY (S&P 500)...")
        cache_path = "models/spy_data_cache.csv"

        if os.path.exists(cache_path):
            data = pd.read_csv(cache_path, index_col=0, parse_dates=True)
            print(f"Loaded cached data: {len(data)} rows")
        else:
            for attempt in range(5):
                data = yf.download("SPY", period="5y")
                if not data.empty:
                    break
                print(f"  Attempt {attempt+1} failed, retrying in 5s...")
                time.sleep(5)

            if data.empty:
                raise ValueError("Failed to download training data after 5 attempts.")

            os.makedirs("models", exist_ok=True)
            data.to_csv(cache_path)
            print(f"Cached data to {cache_path}")

        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.droplevel(1)

        print("Engineering features...")
        df = engineer_features(data)

        df['Future_Return'] = df['Close'].shift(-5) / df['Close'] - 1
        conditions = [
            (df['Future_Return'] < -0.015),
            (df['Future_Return'] >= -0.015) & (df['Future_Return'] <= 0.015),
            (df['Future_Return'] > 0.015)
        ]
        choices = [0, 1, 2]
        df['Target'] = np.select(conditions, choices, default=1)

        df = df.dropna()

        features = [
            'RSI_14', 'RSI_7', 'Price_vs_SMA50_%', 'Price_vs_SMA200_%', 'Volume_Surge',
            'MACD', 'MACD_Signal', 'MACD_Histogram', 'MACD_Cross',
            'BB_PctB', 'BB_Bandwidth',
            'ATR_Pct', 'ADX', 'Plus_DI', 'Minus_DI',
            'Volatility_20', 'Momentum_10', 'Momentum_20'
        ]

        X = df[features]
        y = df['Target']

        # Log dataset info
        mlflow.log_params({
            "ticker": "SPY",
            "data_period": "5y",
            "total_samples": len(X),
            "num_features": len(features),
            "features": str(features),
            "target_threshold_pct": 1.5,
            "target_horizon_days": 5,
        })

        # Log class distribution
        class_counts = y.value_counts().to_dict()
        mlflow.log_params({
            "class_sell_count": int(class_counts.get(0, 0)),
            "class_hold_count": int(class_counts.get(1, 0)),
            "class_buy_count": int(class_counts.get(2, 0)),
        })

        print(f"Training with {len(features)} features on {len(X)} samples...")

        tscv = TimeSeriesSplit(n_splits=5)

        param_grid = {
            'n_estimators': [100, 200],
            'max_depth': [10, 15, None],
            'min_samples_split': [2, 5],
        }

        rf = RandomForestClassifier(random_state=42, class_weight="balanced")
        grid_search = GridSearchCV(rf, param_grid, cv=tscv, scoring='f1_macro', n_jobs=-1, verbose=1)
        grid_search.fit(X, y)

        best_model = grid_search.best_estimator_
        best_params = grid_search.best_params_
        print(f"Best params: {best_params}")

        # Log best hyperparams
        mlflow.log_params(best_params)
        mlflow.log_param("cv_folds", 5)
        mlflow.log_param("scoring", "f1_macro")
        mlflow.log_param("best_cv_score", round(grid_search.best_score_, 4))

        # Cross-validation with per-fold metrics
        print("\n--- Cross-Validation Classification Report ---")
        fold_metrics = []
        for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
            X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
            best_model.fit(X_train, y_train)
            y_pred = best_model.predict(X_test)

            acc = accuracy_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred, average='macro')
            prec = precision_score(y_test, y_pred, average='macro', zero_division=0)
            rec = recall_score(y_test, y_pred, average='macro', zero_division=0)

            fold_metrics.append({"fold": fold + 1, "accuracy": acc, "f1_macro": f1, "precision": prec, "recall": rec})

            mlflow.log_metrics({
                f"fold_{fold+1}_accuracy": round(acc, 4),
                f"fold_{fold+1}_f1_macro": round(f1, 4),
                f"fold_{fold+1}_precision": round(prec, 4),
                f"fold_{fold+1}_recall": round(rec, 4),
            })

            print(f"\nFold {fold+1}:")
            print(classification_report(y_test, y_pred, target_names=["SELL", "HOLD", "BUY"]))

        # Log mean CV metrics
        mean_metrics = {
            "cv_mean_accuracy": round(np.mean([m["accuracy"] for m in fold_metrics]), 4),
            "cv_mean_f1_macro": round(np.mean([m["f1_macro"] for m in fold_metrics]), 4),
            "cv_mean_precision": round(np.mean([m["precision"] for m in fold_metrics]), 4),
            "cv_mean_recall": round(np.mean([m["recall"] for m in fold_metrics]), 4),
        }
        mlflow.log_metrics(mean_metrics)
        print(f"\nMean CV Metrics: {mean_metrics}")

        # Retrain on full data
        best_model.fit(X, y)

        # Feature importances
        importances = best_model.feature_importances_
        feat_imp = dict(zip(features, [round(float(v), 4) for v in importances]))
        mlflow.log_params({f"importance_{k.replace('%', 'pct')}": v for k, v in feat_imp.items()})

        # Plot feature importances
        sorted_idx = np.argsort(importances)
        fig, ax = plt.subplots(figsize=(10, 8))
        ax.barh([features[i] for i in sorted_idx], importances[sorted_idx], color="#3b82f6")
        ax.set_xlabel("Importance")
        ax.set_title("Feature Importances - Random Forest")
        plt.tight_layout()
        fig_path = "feature_importances.png"
        plt.savefig(fig_path, dpi=150)
        plt.close()
        mlflow.log_artifact(fig_path)
        os.remove(fig_path)

        # Log model
        mlflow.sklearn.log_model(
            best_model,
            artifact_path="model",
            registered_model_name="quant-spy-random-forest",
        )

        # Also save locally
        os.makedirs("models", exist_ok=True)
        joblib.dump({"model": best_model, "features": features}, "models/production_random_forest.pkl")
        print("Model trained and saved to models/production_random_forest.pkl")

        # Log the local model file as artifact too
        mlflow.log_artifact("models/production_random_forest.pkl")

        print(f"\nMLflow run completed. View with: mlflow ui")

if __name__ == "__main__":
    train_production_model()
