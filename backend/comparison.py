from exact_engine import ExactQueryEngine
from approximate_engine import ApproximateEngine


def relative_error(exact_val, approx_val):
    return (abs(exact_val-approx_val)/abs(exact_val)) * 100




exact = ExactQueryEngine('datasets/Sales_Product_Combined_cleaned.csv')
dataset = exact.GET_DF()
approx = ApproximateEngine(dataset,sample_frac=0.1)



#----COUNT--------------------
exact_count, t_exact_count = exact._time_it(exact.COUNT)
approx_count, t_approx_count = approx._time_it(approx.COUNT)

error_count = relative_error(exact_count,approx_count)
speedup_count = t_exact_count/t_approx_count


#------SUM-------------
exact_sum, t_exact_sum = exact._time_it(exact.SUM,'price')
approx_sum, t_approx_sum = approx._time_it(approx.SUM, 'price')

error_sum = relative_error(exact_sum,approx_sum)

speedup_sum = t_exact_sum/t_approx_sum

#----AVG-----------
exact_avg, t_exact_avg = exact._time_it(exact.AVG, 'price')
approx_avg, t_approx_avg = approx._time_it(approx.AVG, 'price')

error_avg = relative_error(exact_avg, approx_avg['estimate'])

speedup_avg = t_exact_avg/t_approx_avg


results = [
    {
        'query': 'COUNT(*)',
        'exact': f"{exact_count:,}",
        'approx': f"{approx_count:,}",
        'error' : error_count,
        'speedup': speedup_count
    },
    {
        'query': 'SUM(price)',
        'exact': f"{exact_sum:,.2f}",
        'approx': f"{approx_sum:,.2f}",
        'error' : error_sum,
        'speedup': speedup_sum,
    },
    {
        'query': 'AVG(price)',
        'exact': f"{exact_avg:.2f}",
        'approx': f"{approx_avg['estimate']:.2f} ± {approx_avg['moe']:.2f}",
        'error' : error_avg,
        'speedup': speedup_avg,
    }
    ]


#-----COMPARISON TABLE--------
print(f"\nsample_frac={approx.sample_frac} | "
      f"Sample: {approx.n_sample:,} / {approx.n:,} rows\n")

print(f"{'Query':<15} {'Exact':>18} {'Approx':>22} {'Error%':>8} {'Speedup':>9}")
print("─" * 76)

for row in results:
    print(f"{row['query']:<15} {row['exact']:>18} "
          f"{row['approx']:>22} {row['error']:>7.2f}% "
          f"{row['speedup']:>8.1f}x")
    

def run_tradeoff_analysis(exact,fracs=[0.01,0.05,0.1,0.2,0.5,1.0]):
    exact_avg, t_exact = exact._time_it(exact.AVG,'price')
    print("\n--- Accuracy vs Speed Tradeoff (AVG price) ---\n")
    print(f"{'Frac':<8} {'Estimate':>10} {'Error%':>8} "
          f"{'Speedup':>9} {'95% CI':>25}")
    print("─" * 65)
    
    for frac in fracs:
        eng = ApproximateEngine(dataset,sample_frac=frac)
        result, t = eng._time_it(eng.AVG, 'price')
        error = relative_error(exact_avg, result['estimate'])
        speedup = t_exact/t
        ci = f"[{result['ci_low']:.2f}, {result['ci_high']:.2f}]"
        print(f"{frac:<8} {result['estimate']:>10.2f} {error:>7.2f}% {speedup:>8.1f}x {ci:>25}")

run_tradeoff_analysis(exact)


#GROUP BY COMPARISION
exact_group, t_exact_group = exact._time_it(exact.GROUP_BY,'Product')
naive_groups, t_naive_group = approx._time_it(approx.NGROUP_BY,'Product')


naive_groups = naive_groups.rename(columns={'approx_count':'naive_count'})


comparison = exact_group\
    .merge(naive_groups, on='Product')\

#per group errors
comparison['naive_error%'] = (
    abs(comparison['exact_count'] - comparison['naive_count'])
    / comparison['exact_count'] * 100
).round(2)



print("\n── GROUP BY Comparison (Product) ──────────────────────")
print(f"\n{'Product':<15} {'Exact':>12} {'Naive':>12} {'Error%':>10}")
print("─" * 55)

for _, row in comparison.iterrows():
    print(f"{row['Product']:<15} "
          f"{row['exact_count']:>12,} "
          f"{row['naive_count']:>12,} "
          f"{row['naive_error%']:>9.2f}%")

print("─" * 55)
print(f"{'AVERAGE':<15} {'':>12} {'':>12} "
      f"{comparison['naive_error%'].mean():>9.2f}%")

print(f"\nExact  time: {t_exact_group:.2f} ms")
print(f"Naive  time: {t_naive_group:.2f} ms  →  speedup: {t_exact_group/t_naive_group:.1f}x")

exact = ExactQueryEngine('datasets/synthetic_1M.csv')
df    = exact.GET_DF()
exact_avg = exact.AVG('price')

print("── Accuracy Target Test ──\n")
print(f"{'Target':>8} {'Frac':>6} {'Estimate':>10} {'Error%':>8} {'Speedup':>9}")
print("─" * 48)

for target in [0.80, 0.85, 0.90, 0.95, 0.97, 0.99, 1.00]:
    eng             = ApproximateEngine(df, accuracy_target=target)
    result, t_approx = eng._time_it(eng.AVG, 'price')
    exact_r, t_exact = exact._time_it(exact.AVG, 'price')
    
    error   = relative_error(exact_avg, result['estimate'])
    speedup = t_exact / t_approx
    
    print(f"{target:>8.2f} {eng.sample_frac:>6.2f} "
          f"{result['estimate']:>10.2f} "
          f"{error:>7.2f}% "
          f"{speedup:>8.1f}x")