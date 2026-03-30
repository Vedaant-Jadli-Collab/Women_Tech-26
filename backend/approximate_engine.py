import pandas as pd
import glob
from time import perf_counter
import duckdb
import math

from accuracy_mapper import get_sample_frac
from exact_engine import ExactQueryEngine


class ApproximateEngine:

    def __init__(self,df,sample_frac=None, accuracy_target = None):

        if sample_frac is None and accuracy_target is None:
            raise ValueError("Provide either sampple_frac or accuracy_target")
        
        if sample_frac is not None and accuracy_target is not None:
            raise ValueError("Provide only one of sample_frac or accuracy_target")
        
        if accuracy_target is not None:
            sample_frac = get_sample_frac(accuracy_target)

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
    
    
    
    '''def GROUP_BY_STRATIFIED(self, group_col, n_per_group=500):
    
        # Step 1: stratified sample — safe approach
        groups = self.df[group_col].unique()
        sampled_pieces = []
        
        for group in groups:
            group_rows = self.df[self.df[group_col] == group]
            n          = min(n_per_group, len(group_rows))
            sampled    = group_rows.sample(n, random_state=42)
            sampled_pieces.append(sampled)
        
        stratified = pd.concat(sampled_pieces).reset_index(drop=True)
        
        # Step 2: get true group sizes from full dataset
        true_group_sizes = self.df.groupby(group_col).size()
        
        # Step 3: scale up each group
        results = []
        for group, group_df in stratified.groupby(group_col):
            sampled_count = len(group_df)
            true_size     = true_group_sizes[group]
            actual_frac   = sampled_count / true_size
            
            results.append({
                group_col:      group,
                'approx_count': int(sampled_count/actual_frac)   # you fill this
            })
        
        return pd.DataFrame(results).sort_values('approx_count', ascending=False)'''
    '''def GROUP_BY_STRATIFIED(self, group_col, n_per_group=500):
    
        # Step 1: one vectorized stratified sample — no Python loops
        stratified = (
            self.df
            .groupby(group_col, group_keys=False)
            .apply(lambda x: x.sample(
                min(n_per_group, len(x)), 
                random_state=42
            ))
        )
        print("Shape:        ", stratified.shape)
        print("Columns:      ", stratified.columns.tolist())
        print("Index names:  ", stratified.index.names)
        print("Index type:   ", type(stratified.index))
        print(stratified.head(3))
        # Step 2: ensure group_col is a column, not index
        if group_col in stratified.index.names:
            stratified = stratified.reset_index(level=group_col, drop=True)
        stratified = stratified.reset_index(drop=True)
        
        # Step 3: get true group sizes
        true_group_sizes = self.df.groupby(group_col).size()
        
        # Step 4: scale up each group
        results = []
        for group, group_df in stratified.groupby(group_col):
            sampled_count = len(group_df)
            true_size     = true_group_sizes[group]
            actual_frac   = sampled_count / true_size
            results.append({
                group_col:      group,
                'approx_count': int(sampled_count / actual_frac)
            })
        
        return pd.DataFrame(results).sort_values('approx_count', ascending=False)'''

    
    













        