import pandas as pd
import glob
from time import perf_counter
import duckdb
import math
from exact_engine import ExactQueryEngine

class ApproximateEngine:

    def __init__(self,df,sample_frac=0.1):
        self.conn = duckdb.connect()

        self.df = df

        self.sample_frac = sample_frac

        self.sample_df = df.sample(frac=self.sample_frac, random_state=42)
        self.conn.register("user_table", self.sample_df)

        self.n = len(self.df)
        self.n_sample = len(self.sample_df)

    def GET_DF(self):
        return self.sample_df

    def COUNT(self):
        exactCount = self.conn.execute("""
            SELECT COUNT(*) FROM user_table
        """).df()

        count = int(exactCount.squeeze())
        approxCount = count/self.sample_frac
        return int(approxCount)
    
    def SUM(self,column):
        sampleSum = self.conn.execute(f"""
            SELECT SUM({column})
            FROM user_table
        """).df()

        sampleSum = float(sampleSum.squeeze())

        approxSum = sampleSum/self.sample_frac
        return approxSum


    def AVG(self,column):
        estimate = self.conn.execute(f"""
            SELECT AVG({column})
            FROM user_table
        """).df()
        estimate = float(estimate.squeeze())
        moe = self._margin_of_error(column)
        return {
            'estimate':estimate,
            'ci_low': estimate - moe,
            'ci_high': estimate + moe,
            'moe' : moe
        }
        

    
    def _margin_of_error(self,column,confidence=0.95):
        z=1.96 #for 95% confidence
        std = self.sample_df[column].std(ddof=1)
        n = self.n_sample
        moe = z*(std/math.sqrt(n))
        return moe
    
    def _time_it(self, func, *args):
        start = perf_counter()
        result = func(*args)
        elapsed = (perf_counter() - start) * 1000
        return result, elapsed
    
    def NGROUP_BY(self,group_col):
        sample_group = self.conn.execute(f"""
            SELECT {group_col}, COUNT(*) as sample_count
            FROM user_table
            GROUP BY {group_col}
        """).df()

        sample_group['approx_count'] = sample_group['sample_count']*(1/self.sample_frac)
        sample_group['approx_count'] = sample_group['approx_count'].astype(int)
        
        return sample_group[[group_col,'approx_count']]
    


exact = ExactQueryEngine("datasets/synthetic_1M.csv")
dataset = exact.GET_DF()
approx = ApproximateEngine(dataset)

c = approx.NGROUP_BY('price')
print(c)










        