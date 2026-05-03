import pandas as pd
from sklearn.linear_model import LinearRegression

def train_model():
    df = pd.read_csv("dataset.csv")

    # clean columns
    df.columns = df.columns.str.strip().str.lower()

    # parse date
    df['date'] = pd.to_datetime(df['date'], format="%d-%m-%Y")

    # extract month
    df['month'] = df['date'].dt.month

    # 🔥 GROUP DATA (VERY IMPORTANT)
    monthly = df.groupby('month')['amount'].sum().reset_index()

    # 🔥 DEFINE X and y
    X = monthly[['month']]   # input
    y = monthly['amount']   # output

    # train model
    model = LinearRegression()
    model.fit(X, y)

    return model